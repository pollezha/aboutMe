using System.Net;
using Aspire.Hosting;
using Aspire.Hosting.ApplicationModel;
using Aspire.Hosting.Testing;
using Xunit;

namespace AppHost.Tests;

// Интеграционный: поднимает AppHost целиком, как `dotnet run --project src/AppHost` (AC13):
// PostgreSQL + Kafka + 5 сервисов healthy, gateway отвечает. Сквозной путь событий — tests/Integration.Tests.
public sealed class AppHostTests
{
    private static readonly string[] Services = ["content-api", "events-api", "projector", "live-hub", "gateway"];

    // Холодный старт: образы Postgres/Kafka, миграции, сид контента
    private static readonly TimeSpan StartupTimeout = TimeSpan.FromSeconds(180);

    [Fact]
    [Trait("Category", "Integration")]
    public async Task All_services_become_healthy_and_gateway_serves_content()
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

        using (var content = await client.GetAsync("/api/content/en", ct))
        {
            Assert.Equal(HttpStatusCode.OK, content.StatusCode);
            Assert.NotNull(content.Headers.ETag);
        }
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
}
