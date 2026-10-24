using System.Globalization;
using Aspire.Hosting;
using Aspire.Hosting.ApplicationModel;
using Aspire.Hosting.Testing;
using Xunit;

namespace Integration.Tests;

/// <summary>
/// Отдельный AppHost с коротким лимитом событий в gateway (5 за 10 с): лимиты по IP живут весь запуск, а все тесты
/// ходят с 127.0.0.1 — исчерпание лимита в основной коллекции сломало бы остальные её тесты.
/// </summary>
public sealed class RateLimitAppFixture : IAsyncLifetime
{
    public const int EventsPermitLimit = 5;

    public static readonly TimeSpan EventsWindow = TimeSpan.FromSeconds(10);

    private static readonly TimeSpan StartupTimeout = TimeSpan.FromSeconds(180);

    private DistributedApplication? _app;

    public HttpClient Gateway { get; private set; } = null!;

    public string StatsConnectionString { get; private set; } = null!;

    public async ValueTask InitializeAsync()
    {
        using var startup = new CancellationTokenSource(StartupTimeout);
        var appHost = await DistributedApplicationTestingBuilder.CreateAsync<Projects.AppHost>(startup.Token);
        appHost.CreateResourceBuilder<ProjectResource>("gateway")
            .WithEnvironment("RateLimits__Events__PermitLimit", EventsPermitLimit.ToString(CultureInfo.InvariantCulture))
            .WithEnvironment("RateLimits__Events__Window", EventsWindow.ToString("c", CultureInfo.InvariantCulture));
        _app = await appHost.BuildAsync(startup.Token);
        await _app.StartAsync(startup.Token);
        // gateway ждёт (WaitFor) остальные сервисы, но health projector нужен явно: тест читает stats
        await Task.WhenAll(
            _app.ResourceNotifications.WaitForResourceHealthyAsync("gateway", startup.Token),
            _app.ResourceNotifications.WaitForResourceHealthyAsync("projector", startup.Token));

        Gateway = _app.CreateHttpClient("gateway");
        StatsConnectionString = await _app.GetConnectionStringAsync("stats", startup.Token)
            ?? throw new InvalidOperationException("Ресурс stats не выдал connection string.");
    }

    public async ValueTask DisposeAsync()
    {
        Gateway?.Dispose();
        if (_app is not null)
        {
            await _app.DisposeAsync();
        }
    }
}

// Без параллелизма: второй AppHost (PostgreSQL, Kafka, 5 сервисов) поднимается после основной коллекции, не вместе с ней
[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class RateLimitGroup : ICollectionFixture<RateLimitAppFixture>
{
    public const string Name = "RateLimit";
}
