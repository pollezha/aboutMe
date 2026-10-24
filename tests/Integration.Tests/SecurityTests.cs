using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Npgsql;
using Xunit;

namespace Integration.Tests;

// Негатив и приватность через gateway: невалидное событие (TC-15), нет cookies и IP (TC-20), записка в бутылке без
// Telegram (TC-21). Лимит 429 — в RateLimitTests на отдельном AppHost.
[Collection(AppGroup.Name)]
[Trait("Category", "Integration")]
public sealed class SecurityTests(AppFixture app)
{
    private const string ProblemJson = "application/problem+json";

    // Пауза, за которую событие, попади оно в Kafka, успело бы дойти до stats
    private static readonly TimeSpan SettleTime = TimeSpan.FromSeconds(3);

    [Fact]
    public async Task Event_without_type_is_rejected_with_errors_and_never_reaches_stats()
    {
        var ct = TestContext.Current.CancellationToken;
        var invalid = Stats.StopOpened("profile");
        invalid.Remove("type");
        var eventId = Guid.Parse(invalid["eventId"]!.GetValue<string>());
        var before = await Stats.QuiescentTotalAsync(app.StatsConnectionString, ct);

        using var response = await app.Gateway.PostAsJsonAsync("/api/events", invalid, ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await ReadProblemAsync(response, ct);
        Assert.True(problem.TryGetProperty("errors", out var errors) && errors.EnumerateObject().Any());
        await Task.Delay(SettleTime, ct);
        Assert.Equal(before, await Stats.TotalAsync(app.StatsConnectionString, ct));
        Assert.Equal(0, await Stats.ProcessedCountAsync(app.StatsConnectionString, eventId, ct));
    }

    [Fact]
    public async Task Malformed_json_is_rejected_with_400()
    {
        var ct = TestContext.Current.CancellationToken;
        using var body = new StringContent("{\"eventId\":", Encoding.UTF8, "application/json");

        using var response = await app.Gateway.PostAsync("/api/events", body, ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await ReadProblemAsync(response, ct);
    }

    [Fact]
    public async Task Event_body_over_16_kb_is_rejected_with_413()
    {
        var ct = TestContext.Current.CancellationToken;
        var oversized = Stats.StopOpened("profile");
        oversized["padding"] = new string('x', 17 * 1024);
        // StringContent задаёт Content-Length — так тело отклоняется до бэкенда, как у браузера
        using var body = new StringContent(oversized.ToJsonString(), Encoding.UTF8, "application/json");

        using var response = await app.Gateway.PostAsync("/api/events", body, ct);

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);
        await ReadProblemAsync(response, ct);
    }

    [Fact]
    public async Task Gateway_responses_set_no_cookies()
    {
        var ct = TestContext.Current.CancellationToken;
        using var content = await app.Gateway.GetAsync("/api/content/en", ct);
        using var events = await app.Gateway.PostAsJsonAsync("/api/events", Stats.StopOpened("profile"), ct);
        using var alive = await app.Gateway.GetAsync("/alive", ct);

        Assert.Equal(HttpStatusCode.OK, content.StatusCode);
        Assert.Equal(HttpStatusCode.Accepted, events.StatusCode);
        Assert.Equal(HttpStatusCode.OK, alive.StatusCode);
        Assert.All([content, events, alive], r => Assert.False(r.Headers.Contains("Set-Cookie"), r.RequestMessage?.RequestUri?.ToString()));
    }

    [Fact]
    public async Task Stats_schema_has_no_ip_or_user_agent_columns_and_no_ip_values()
    {
        var ct = TestContext.Current.CancellationToken;
        // Хотя бы одна строка в агрегатах и processed_events, чтобы проверка значений не была пустой
        var opened = Stats.StopOpened("profile");
        var eventId = Guid.Parse(opened["eventId"]!.GetValue<string>());
        using (var response = await app.Gateway.PostAsJsonAsync("/api/events", opened, ct))
        {
            Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        }

        await Stats.WaitForAsync(() => Stats.ProcessedCountAsync(app.StatsConnectionString, eventId, ct), n => n > 0, ct);

        await using var connection = new NpgsqlConnection(app.StatsConnectionString);
        await connection.OpenAsync(ct);
        var columns = await StatsColumnsAsync(connection, ct);

        Assert.NotEmpty(columns);
        Assert.DoesNotContain(columns, c => LooksLikeClientColumn(c.Column));
        foreach (var (table, column, _) in columns.Where(c => c.IsText))
        {
            await using var command = new NpgsqlCommand(
                $"SELECT count(*) FROM stats.\"{table}\" WHERE \"{column}\" ~ '(\\d{{1,3}}\\.){{3}}\\d{{1,3}}'",
                connection);
            var matches = Convert.ToInt64(await command.ExecuteScalarAsync(ct), CultureInfo.InvariantCulture);
            Assert.True(matches == 0, $"stats.{table}.{column}: {matches} строк(и) со значением вида IPv4");
        }
    }

    [Fact]
    public async Task Message_with_filled_honeypot_gets_204_and_sends_nothing()
    {
        var ct = TestContext.Current.CancellationToken;
        var day = DateOnly.FromDateTime(DateTime.UtcNow);
        var before = await Stats.BottleClicksAsync(app.StatsConnectionString, day, ct);
        var message = ValidMessage();
        message["website"] = "https://spam.example";

        using var response = await app.Gateway.PostAsJsonAsync("/api/messages", message, ct);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        await Task.Delay(SettleTime, ct);
        Assert.Equal(before, await Stats.BottleClicksAsync(app.StatsConnectionString, day, ct));
    }

    [Fact]
    public async Task Valid_message_without_configured_telegram_gets_503_without_details()
    {
        var ct = TestContext.Current.CancellationToken;
        var message = ValidMessage();

        using var response = await app.Gateway.PostAsJsonAsync("/api/messages", message, ct);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        var raw = await response.Content.ReadAsStringAsync(ct);
        var problem = await ReadProblemAsync(response, ct);
        Assert.Equal("Message delivery unavailable", problem.GetProperty("title").GetString());
        Assert.False(problem.TryGetProperty("detail", out _));
        Assert.DoesNotContain("Telegram", raw, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(message["text"]!.GetValue<string>(), raw, StringComparison.Ordinal);
    }

    private static JsonObject ValidMessage() => new()
    {
        ["name"] = "Integration test",
        ["replyTo"] = "@it_reviewer",
        ["text"] = $"Hello from SecurityTests {Guid.NewGuid():N}",
        ["sessionId"] = $"it-{Guid.NewGuid():N}",
        ["lang"] = "en",
        ["theme"] = "day",
    };

    internal static async Task<JsonElement> ReadProblemAsync(HttpResponseMessage response, CancellationToken ct)
    {
        Assert.Equal(ProblemJson, response.Content.Headers.ContentType?.MediaType);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        Assert.Equal((int)response.StatusCode, document.RootElement.GetProperty("status").GetInt32());
        return document.RootElement.Clone();
    }

    private static async Task<List<(string Table, string Column, bool IsText)>> StatsColumnsAsync(
        NpgsqlConnection connection,
        CancellationToken ct)
    {
        await using var command = new NpgsqlCommand(
            """
            SELECT c.table_name, c.column_name, c.data_type IN ('text', 'character varying', 'character', 'inet', 'cidr')
            FROM information_schema.columns c
            JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
            WHERE c.table_schema = 'stats' AND t.table_type = 'BASE TABLE'
            """,
            connection);
        await using var reader = await command.ExecuteReaderAsync(ct);
        var columns = new List<(string, string, bool)>();
        while (await reader.ReadAsync(ct))
        {
            columns.Add((reader.GetString(0), reader.GetString(1), reader.GetBoolean(2)));
        }

        return columns;
    }

    // ip как отдельное слово (ip, client_ip, ip_hash), адрес и user agent в любом написании
    private static bool LooksLikeClientColumn(string column)
    {
        var name = column.ToUpperInvariant();
        return name == "IP" || name.StartsWith("IP_", StringComparison.Ordinal) || name.EndsWith("_IP", StringComparison.Ordinal)
            || name.Contains("_IP_", StringComparison.Ordinal) || name.Contains("ADDR", StringComparison.Ordinal)
            || name.Contains("AGENT", StringComparison.Ordinal);
    }
}

// TC-15: 429 после исчерпания лимита событий, отклонённое событие не попадает в Kafka/stats; после окна — снова 202
[Collection(RateLimitGroup.Name)]
[Trait("Category", "Integration")]
public sealed class RateLimitTests(RateLimitAppFixture app)
{
    private static readonly TimeSpan SettleTime = TimeSpan.FromSeconds(3);

    [Fact]
    public async Task Events_over_the_limit_get_429_with_retry_after_and_pass_again_after_the_window()
    {
        var ct = TestContext.Current.CancellationToken;
        for (var i = 1; i <= RateLimitAppFixture.EventsPermitLimit; i++)
        {
            using var accepted = await app.Gateway.PostAsJsonAsync("/api/events", Stats.StopOpened("profile"), ct);
            Assert.True(accepted.StatusCode == HttpStatusCode.Accepted, $"запрос {i}: {accepted.StatusCode}");
        }

        var rejected = Stats.StopOpened("profile");
        var rejectedId = Guid.Parse(rejected["eventId"]!.GetValue<string>());
        using (var response = await app.Gateway.PostAsJsonAsync("/api/events", rejected, ct))
        {
            Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
            await SecurityTests.ReadProblemAsync(response, ct);
            var retryAfter = response.Headers.RetryAfter?.Delta;
            Assert.NotNull(retryAfter);
            Assert.InRange(retryAfter.Value, TimeSpan.FromSeconds(1), RateLimitAppFixture.EventsWindow);

            await Task.Delay(retryAfter.Value + TimeSpan.FromSeconds(1), ct);
        }

        var next = Stats.StopOpened("profile");
        var nextId = Guid.Parse(next["eventId"]!.GetValue<string>());
        using (var response = await app.Gateway.PostAsJsonAsync("/api/events", next, ct))
        {
            Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        }

        // Принятое после окна событие дошло до stats, а отклонённое за это время — нет
        await Stats.WaitForAsync(() => Stats.ProcessedCountAsync(app.StatsConnectionString, nextId, ct), n => n > 0, ct);
        await Task.Delay(SettleTime, ct);
        Assert.Equal(0, await Stats.ProcessedCountAsync(app.StatsConnectionString, rejectedId, ct));
    }
}

// Чтение stats и построение событий для тестов безопасности
internal static class Stats
{
    private static readonly TimeSpan ProjectionTimeout = TimeSpan.FromSeconds(15);
    private static readonly TimeSpan PollInterval = TimeSpan.FromMilliseconds(250);
    private static readonly TimeSpan QuietPeriod = TimeSpan.FromSeconds(1);

    public static JsonObject StopOpened(string stop) => new()
    {
        ["eventId"] = Guid.CreateVersion7().ToString(),
        ["type"] = "stop_opened",
        ["occurredAt"] = DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture),
        ["sessionId"] = $"it-{Guid.NewGuid():N}",
        ["lang"] = "en",
        ["theme"] = "day",
        ["payload"] = new JsonObject { ["stop"] = stop },
    };

    /// <summary>Сумма всех агрегатов и число обработанных событий — меняется, если что-то дошло до stats.</summary>
    public static Task<long> TotalAsync(string connectionString, CancellationToken ct) => ScalarAsync(
        connectionString,
        """
        SELECT (SELECT coalesce(sum(visits), 0) FROM stats.daily_visits)
             + (SELECT coalesce(sum(n), 0) FROM stats.stop_opens)
             + (SELECT coalesce(sum(n), 0) FROM stats.cta_clicks)
             + (SELECT coalesce(sum(n), 0) FROM stats.web_vitals)
             + (SELECT count(*) FROM stats.processed_events)
        """,
        [],
        ct);

    /// <summary>
    /// <see cref="TotalAsync"/> после затишья: события предыдущих тестов коллекции могут ещё проецироваться.
    /// </summary>
    public static async Task<long> QuiescentTotalAsync(string connectionString, CancellationToken ct)
    {
        var deadline = DateTime.UtcNow + ProjectionTimeout;
        var previous = await TotalAsync(connectionString, ct);
        while (true)
        {
            await Task.Delay(QuietPeriod, ct);
            var current = await TotalAsync(connectionString, ct);
            if (current == previous)
            {
                return current;
            }

            Assert.True(DateTime.UtcNow < deadline, "stats не затихает: события продолжают проецироваться.");
            previous = current;
        }
    }

    public static Task<long> BottleClicksAsync(string connectionString, DateOnly day, CancellationToken ct) => ScalarAsync(
        connectionString,
        "SELECT coalesce(sum(n), 0) FROM stats.cta_clicks WHERE day = $1 AND cta = 'bottle'",
        [day],
        ct);

    public static Task<long> ProcessedCountAsync(string connectionString, Guid eventId, CancellationToken ct) => ScalarAsync(
        connectionString,
        "SELECT count(*) FROM stats.processed_events WHERE event_id = $1",
        [eventId],
        ct);

    public static async Task<long> WaitForAsync(Func<Task<long>> read, Func<long, bool> done, CancellationToken ct)
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

    private static async Task<long> ScalarAsync(string connectionString, string sql, object[] parameters, CancellationToken ct)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(ct);
        await using var command = new NpgsqlCommand(sql, connection);
        foreach (var parameter in parameters)
        {
            command.Parameters.Add(new NpgsqlParameter { Value = parameter });
        }

        return Convert.ToInt64(await command.ExecuteScalarAsync(ct), CultureInfo.InvariantCulture);
    }
}
