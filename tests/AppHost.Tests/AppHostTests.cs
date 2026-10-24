using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Aspire.Hosting;
using Aspire.Hosting.ApplicationModel;
using Aspire.Hosting.Testing;
using Npgsql;
using Xunit;

namespace AppHost.Tests;

// Интеграционный: поднимает AppHost целиком, как `dotnet run --project src/AppHost` (AC13):
// PostgreSQL + Kafka + 5 сервисов, событие проходит gateway → events-api → Kafka → projector → stats.
public sealed class AppHostTests
{
    private static readonly string[] Services = ["content-api", "events-api", "projector", "live-hub", "gateway"];

    // Холодный старт: образы Postgres/Kafka, миграции, сид контента
    private static readonly TimeSpan StartupTimeout = TimeSpan.FromSeconds(180);
    private static readonly TimeSpan ProjectionTimeout = TimeSpan.FromSeconds(15);

    [Fact]
    [Trait("Category", "Integration")]
    public async Task All_services_become_healthy_and_event_reaches_stats_through_gateway()
    {
        var ct = TestContext.Current.CancellationToken;
        var appHost = await DistributedApplicationTestingBuilder.CreateAsync<Projects.AppHost>(ct);

        await using var app = await appHost.BuildAsync(ct).WaitAsync(StartupTimeout, ct);
        using var startup = CancellationTokenSource.CreateLinkedTokenSource(ct);
        startup.CancelAfter(StartupTimeout);
        await app.StartAsync(startup.Token);
        await Task.WhenAll(Services.Select(s => app.ResourceNotifications.WaitForResourceHealthyAsync(s, startup.Token)));

        using var client = app.CreateHttpClient("gateway");
        using (var health = await client.GetAsync("/health", ct))
        {
            Assert.Equal(HttpStatusCode.OK, health.StatusCode);
        }

        using (var accepted = await client.PostAsJsonAsync("/api/events", CtaClick("github"), ct))
        {
            Assert.Equal(HttpStatusCode.Accepted, accepted.StatusCode);
        }

        using (var content = await client.GetAsync("/api/content/en", ct))
        {
            Assert.Equal(HttpStatusCode.OK, content.StatusCode);
            Assert.NotNull(content.Headers.ETag);
        }

        var stats = await app.GetConnectionStringAsync("stats", ct);
        Assert.True(
            await WaitForCtaClicksAsync(stats!, "github", ct),
            $"Клик не дошёл до stats.cta_clicks за {ProjectionTimeout.TotalSeconds:0} с");
    }

    // В тестах порты случайные, а `dotnet run` берёт их из launchSettings: совпавший порт отдаёт DCP одному
    // сервису, и gateway проксирует в чужой
    [Fact]
    public async Task Service_endpoints_from_launch_settings_use_distinct_ports()
    {
        var ct = TestContext.Current.CancellationToken;
        var appHost = await DistributedApplicationTestingBuilder.CreateAsync<Projects.AppHost>(ct);

        var ports = appHost.Resources.OfType<ProjectResource>()
            .SelectMany(r => r.Annotations.OfType<EndpointAnnotation>().Select(e => (Resource: r.Name, e.Port)))
            .Where(e => e.Port is not null)
            .ToList();

        Assert.Equal(Services.Length, ports.Select(e => e.Resource).Distinct().Count());
        var duplicates = ports.GroupBy(e => e.Port).Where(g => g.Count() > 1)
            .Select(g => $"{g.Key}: {string.Join(", ", g.Select(e => e.Resource))}");
        Assert.Empty(duplicates);
    }

    private static JsonObject CtaClick(string cta) => new()
    {
        ["eventId"] = Guid.CreateVersion7().ToString(),
        ["type"] = "cta_click",
        ["occurredAt"] = DateTimeOffset.UtcNow.ToString("O"),
        ["sessionId"] = "apphost-test-session",
        ["lang"] = "en",
        ["theme"] = "day",
        ["payload"] = new JsonObject { ["cta"] = cta },
    };

    private static async Task<bool> WaitForCtaClicksAsync(string connectionString, string cta, CancellationToken ct)
    {
        await using var dataSource = NpgsqlDataSource.Create(connectionString);
        var deadline = DateTime.UtcNow + ProjectionTimeout;
        while (DateTime.UtcNow < deadline)
        {
            await using var command = dataSource.CreateCommand("SELECT coalesce(sum(n), 0) FROM stats.cta_clicks WHERE cta = $1");
            command.Parameters.AddWithValue(cta);
            if (Convert.ToInt64(await command.ExecuteScalarAsync(ct), System.Globalization.CultureInfo.InvariantCulture) > 0)
            {
                return true;
            }

            await Task.Delay(TimeSpan.FromMilliseconds(500), ct);
        }

        return false;
    }
}
