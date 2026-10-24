using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Npgsql;
using Xunit;

namespace Integration.Tests;

// Сквозной путь события: gateway → events-api → Kafka → projector → stats (TC-12, AC8 — дубль не дублирует агрегат).
// Агрегаты общие для всего запуска AppHost, поэтому проверяется приращение относительно значения до теста.
[Collection(AppGroup.Name)]
[Trait("Category", "Integration")]
public sealed class EventsEndToEndTests(AppFixture app)
{
    // projector не имеет события-источника в контракте v1 → cta_clicks.source = "unknown"
    private const string UnknownSource = "unknown";

    private static readonly TimeSpan ProjectionTimeout = TimeSpan.FromSeconds(15);
    private static readonly TimeSpan DuplicateSettleTime = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan PollInterval = TimeSpan.FromMilliseconds(250);

    [Fact]
    public async Task Cta_click_through_gateway_increments_cta_clicks_by_one()
    {
        var ct = TestContext.Current.CancellationToken;
        var click = CtaClick("cv");
        var day = Day(click);
        var before = await CtaClicksAsync(day, "cv", ct);

        await PostAcceptedAsync(click, ct);

        var after = await WaitForAsync(() => CtaClicksAsync(day, "cv", ct), n => n > before, ct);
        Assert.Equal(before + 1, after);
    }

    [Fact]
    public async Task Same_event_sent_three_times_is_counted_once()
    {
        var ct = TestContext.Current.CancellationToken;
        var click = CtaClick("cv");
        var day = Day(click);
        var eventId = Guid.Parse(click["eventId"]!.GetValue<string>());
        var before = await CtaClicksAsync(day, "cv", ct);

        await PostAcceptedAsync(click, ct);
        await WaitForAsync(() => ProcessedCountAsync(eventId, ct), n => n > 0, ct);
        await PostAcceptedAsync(click, ct);
        await PostAcceptedAsync(click, ct);
        await Task.Delay(DuplicateSettleTime, ct);

        Assert.Equal(before + 1, await CtaClicksAsync(day, "cv", ct));
        Assert.Equal(1, await ProcessedCountAsync(eventId, ct));
    }

    [Fact]
    public async Task Stop_opened_through_gateway_increments_stop_opens()
    {
        var ct = TestContext.Current.CancellationToken;
        var opened = Event("stop_opened", new JsonObject { ["stop"] = "profile" });
        var day = Day(opened);
        var before = await StopOpensAsync(day, "profile", ct);

        await PostAcceptedAsync(opened, ct);

        var after = await WaitForAsync(() => StopOpensAsync(day, "profile", ct), n => n > before, ct);
        Assert.Equal(before + 1, after);
    }

    [Fact]
    public async Task Event_with_traceparent_is_accepted_without_body()
    {
        var ct = TestContext.Current.CancellationToken;
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/events")
        {
            Content = JsonContent.Create(CtaClick("contact")),
        };
        request.Headers.Add("traceparent", "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");

        using var response = await app.Gateway.SendAsync(request, ct);

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Empty(await response.Content.ReadAsByteArrayAsync(ct));
    }

    private async Task PostAcceptedAsync(JsonObject siteEvent, CancellationToken ct)
    {
        using var response = await app.Gateway.PostAsJsonAsync("/api/events", siteEvent, ct);
        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Empty(await response.Content.ReadAsByteArrayAsync(ct));
    }

    private Task<long> CtaClicksAsync(DateOnly day, string cta, CancellationToken ct) => ScalarAsync(
        "SELECT coalesce(sum(n), 0) FROM stats.cta_clicks WHERE day = $1 AND cta = $2 AND source = $3",
        [day, cta, UnknownSource],
        ct);

    private Task<long> StopOpensAsync(DateOnly day, string stop, CancellationToken ct) => ScalarAsync(
        "SELECT coalesce(sum(n), 0) FROM stats.stop_opens WHERE day = $1 AND stop = $2",
        [day, stop],
        ct);

    private Task<long> ProcessedCountAsync(Guid eventId, CancellationToken ct) => ScalarAsync(
        "SELECT count(*) FROM stats.processed_events WHERE event_id = $1",
        [eventId],
        ct);

    private async Task<long> ScalarAsync(string sql, object[] parameters, CancellationToken ct)
    {
        await using var connection = new NpgsqlConnection(app.StatsConnectionString);
        await connection.OpenAsync(ct);
        await using var command = new NpgsqlCommand(sql, connection);
        foreach (var parameter in parameters)
        {
            command.Parameters.Add(new NpgsqlParameter { Value = parameter });
        }

        return Convert.ToInt64(await command.ExecuteScalarAsync(ct), CultureInfo.InvariantCulture);
    }

    private static async Task<long> WaitForAsync(Func<Task<long>> read, Func<long, bool> done, CancellationToken ct)
    {
        var deadline = DateTime.UtcNow + ProjectionTimeout;
        while (true)
        {
            var value = await read();
            if (done(value))
            {
                return value;
            }

            Assert.True(
                DateTime.UtcNow < deadline,
                $"Событие не дошло до stats за {ProjectionTimeout.TotalSeconds:0} с (последнее значение {value}).");
            await Task.Delay(PollInterval, ct);
        }
    }

    private static DateOnly Day(JsonObject siteEvent) => DateOnly.FromDateTime(
        DateTimeOffset.Parse(siteEvent["occurredAt"]!.GetValue<string>(), CultureInfo.InvariantCulture).UtcDateTime);

    private static JsonObject CtaClick(string cta) => Event("cta_click", new JsonObject { ["cta"] = cta });

    private static JsonObject Event(string type, JsonObject payload) => new()
    {
        ["eventId"] = Guid.CreateVersion7().ToString(),
        ["type"] = type,
        ["occurredAt"] = DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture),
        ["sessionId"] = $"it-{Guid.NewGuid():N}",
        ["lang"] = "en",
        ["theme"] = "day",
        ["payload"] = payload,
    };
}
