using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Projector.Infrastructure.Persistence;
using Xunit;

namespace Projector.Tests;

[Trait("Category", "Integration")]
public sealed class StatsSchemaTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>
{
    private static readonly string[] StatsTables =
        ["cta_clicks", "daily_visits", "processed_events", "stop_opens", "web_vitals"];

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Migrate_on_clean_database_creates_stats_tables()
    {
        await using var services = PostgresFixture.CreateServices(postgres.NewDatabase());

        var exitCode = await StatsMigrations.ApplyAsync(services, NullLogger.Instance, Ct);

        Assert.Equal(0, exitCode);
        var tables = await QueryStatsTablesAsync(services);
        Assert.Equal(StatsTables, tables.Where(t => !t.StartsWith("__", StringComparison.Ordinal)));
    }

    [Fact]
    public async Task Repeated_migrate_is_noop()
    {
        await using var services = PostgresFixture.CreateServices(postgres.NewDatabase());
        Assert.Equal(0, await StatsMigrations.ApplyAsync(services, NullLogger.Instance, Ct));

        var exitCode = await StatsMigrations.ApplyAsync(services, NullLogger.Instance, Ct);

        Assert.Equal(0, exitCode);
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<StatsDbContext>();
        Assert.Empty(await db.Database.GetPendingMigrationsAsync(Ct));
        Assert.Single(await db.Database.GetAppliedMigrationsAsync(Ct));
    }

    [Fact]
    public async Task Processed_events_rejects_duplicate_event_id()
    {
        await using var services = PostgresFixture.CreateServices(postgres.NewDatabase());
        Assert.Equal(0, await StatsMigrations.ApplyAsync(services, NullLogger.Instance, Ct));
        var eventId = Guid.NewGuid();
        await InsertProcessedEventAsync(services, eventId);

        var ex = await Assert.ThrowsAsync<DbUpdateException>(() => InsertProcessedEventAsync(services, eventId));

        var pg = Assert.IsType<PostgresException>(ex.InnerException);
        Assert.Equal(PostgresErrorCodes.UniqueViolation, pg.SqlState);
    }

    private static async Task<List<string>> QueryStatsTablesAsync(IServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<StatsDbContext>();
        return await db.Database
            .SqlQuery<string>($"""
                SELECT table_name AS "Value" FROM information_schema.tables
                WHERE table_schema = 'stats' AND table_type = 'BASE TABLE'
                ORDER BY table_name
                """)
            .ToListAsync(Ct);
    }

    private static async Task InsertProcessedEventAsync(IServiceProvider services, Guid eventId)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<StatsDbContext>();
        db.ProcessedEvents.Add(new ProcessedEvent { EventId = eventId, ProcessedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync(Ct);
    }
}
