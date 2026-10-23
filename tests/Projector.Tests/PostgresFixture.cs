using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Projector.Data;
using Testcontainers.PostgreSql;
using Xunit;

namespace Projector.Tests;

/// <summary>Один контейнер PostgreSQL на класс тестов; каждый тест берёт свою чистую базу.</summary>
public sealed class PostgresFixture : IAsyncLifetime
{
    public const string Image = "postgres:17-alpine";
    private static readonly TimeSpan StartTimeout = TimeSpan.FromSeconds(90);

    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder(Image).Build();

    public async ValueTask InitializeAsync()
    {
        using var cts = new CancellationTokenSource(StartTimeout);
        try
        {
            await _container.StartAsync(cts.Token);
        }
        catch (Exception ex) when (ex is OperationCanceledException or DotNet.Testcontainers.Builders.DockerUnavailableException)
        {
            throw new InvalidOperationException(
                $"PostgreSQL container ({Image}) did not start within {StartTimeout.TotalSeconds:0} s. Is Docker running?", ex);
        }
    }

    public ValueTask DisposeAsync() => _container.DisposeAsync();

    /// <summary>Строка подключения к ещё не созданной базе с уникальным именем (её создаст MigrateAsync).</summary>
    public string NewDatabase() =>
        new NpgsqlConnectionStringBuilder(_container.GetConnectionString())
        {
            Database = $"stats_{Guid.NewGuid():N}",
        }.ConnectionString;

    public static ServiceProvider CreateServices(string connectionString)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDbContext<StatsDbContext>(o => o.UseNpgsql(connectionString, StatsDbContext.ConfigureNpgsql));
        return services.BuildServiceProvider();
    }
}
