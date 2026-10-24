using Aspire.Hosting;
using Aspire.Hosting.Testing;
using Xunit;

namespace Integration.Tests;

/// <summary>
/// Один запуск AppHost на весь проект (как <c>dotnet run --project src/AppHost</c>): PostgreSQL, Kafka, 5 сервисов.
/// Тесты ходят на сайт только через gateway и читают агрегаты из БД <c>stats</c>.
/// </summary>
public sealed class AppFixture : IAsyncLifetime
{
    private static readonly string[] Services = ["content-api", "events-api", "projector", "live-hub", "gateway"];

    // Холодный старт: образы Postgres/Kafka, миграции, сид контента
    private static readonly TimeSpan StartupTimeout = TimeSpan.FromSeconds(180);

    private DistributedApplication? _app;

    /// <summary>Запущенное приложение: остановка и запуск ресурсов (NFR4), адреса эндпоинтов.</summary>
    public DistributedApplication App => _app ?? throw new InvalidOperationException("AppHost не запущен.");

    public HttpClient Gateway { get; private set; } = null!;

    public string StatsConnectionString { get; private set; } = null!;

    public async ValueTask InitializeAsync()
    {
        using var startup = new CancellationTokenSource(StartupTimeout);
        var appHost = await DistributedApplicationTestingBuilder.CreateAsync<Projects.AppHost>(startup.Token);
        _app = await appHost.BuildAsync(startup.Token);
        await _app.StartAsync(startup.Token);
        await Task.WhenAll(Services.Select(s => _app.ResourceNotifications.WaitForResourceHealthyAsync(s, startup.Token)));

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

[CollectionDefinition(Name)]
public sealed class AppGroup : ICollectionFixture<AppFixture>
{
    public const string Name = "App";
}
