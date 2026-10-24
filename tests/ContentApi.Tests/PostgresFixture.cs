using ContentApi.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Testcontainers.PostgreSql;
using Xunit;

namespace ContentApi.Tests;

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

    /// <summary>Новая база с уникальным именем и применёнными миграциями схемы <c>content</c>.</summary>
    public async Task<string> NewMigratedDatabaseAsync(CancellationToken cancellationToken)
    {
        var connectionString = new NpgsqlConnectionStringBuilder(_container.GetConnectionString())
        {
            Database = $"content_{Guid.NewGuid():N}",
        }.ConnectionString;

        await using var services = CreateServices(connectionString);
        var exitCode = await ContentMigrations.ApplyAsync(services, NullLogger.Instance, cancellationToken);
        if (exitCode != 0)
        {
            throw new InvalidOperationException("Content migrations failed");
        }

        return connectionString;
    }

    public static ServiceProvider CreateServices(string connectionString)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDbContext<ContentDbContext>(o => o.UseNpgsql(connectionString, ContentDbContext.ConfigureNpgsql));
        return services.BuildServiceProvider();
    }
}
