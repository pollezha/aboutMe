using System.Diagnostics;
using System.Text.Json;
using BuildingBlocks.Persistence;
using Contracts;
using Contracts.Events;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Projector.Application.Abstractions;
using Projector.Application.ProjectEvents;
using Projector.Domain;
using Projector.Infrastructure.Persistence;
using Xunit;

namespace Projector.Tests.Infrastructure;

/// <summary>Хендлер на настоящих репозиториях и <see cref="EfUnitOfWork{TDbContext}"/>: отметка и агрегат — одна транзакция.</summary>
[Trait("Category", "Integration")]
public sealed class ProjectEventsTransactionTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>
{
    private static readonly DateTimeOffset Noon = new(2026, 10, 20, 12, 0, 0, TimeSpan.Zero);

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Batch_is_committed_and_redelivery_does_not_change_aggregates()
    {
        var database = await MigratedDatabaseAsync();
        var siteEvent = StopOpened();

        Assert.Equal(1, await ProjectAsync(database, siteEvent, failApply: false));
        Assert.Equal(0, await ProjectAsync(database, siteEvent, failApply: false));

        Assert.Equal(1, await ScalarAsync(database, "SELECT count(*) FROM stats.processed_events"));
        Assert.Equal(1, await ScalarAsync(database, "SELECT coalesce(sum(n), 0) FROM stats.stop_opens"));
    }

    [Fact]
    public async Task Failure_after_marking_processed_rolls_the_mark_back()
    {
        var database = await MigratedDatabaseAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() => ProjectAsync(database, StopOpened(), failApply: true));

        Assert.Equal(0, await ScalarAsync(database, "SELECT count(*) FROM stats.processed_events"));
        Assert.Equal(0, await ScalarAsync(database, "SELECT count(*) FROM stats.stop_opens"));
    }

    private async Task<string> MigratedDatabaseAsync()
    {
        var database = postgres.NewDatabase();
        await using var services = PostgresFixture.CreateServices(database);
        Assert.Equal(0, await StatsMigrations.ApplyAsync(services, NullLogger.Instance, Ct));
        return database;
    }

    private static async Task<int> ProjectAsync(string database, SiteEvent siteEvent, bool failApply)
    {
        await using var services = PostgresFixture.CreateServices(database);
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<StatsDbContext>();
        await using var unitOfWork = new EfUnitOfWork<StatsDbContext>(db);
        IStatsRepository stats = new StatsRepository(db);
        if (failApply)
        {
            stats = new FailingStatsRepository();
        }

        var handler = new ProjectEventsHandler(unitOfWork, new ProcessedEventsRepository(db), stats);
        return await handler.HandleAsync(new ProjectEventsCommand([siteEvent], Array.Empty<ActivityLink>()), Ct);
    }

    private static async Task<long> ScalarAsync(string database, string sql)
    {
        await using var connection = new NpgsqlConnection(database);
        await connection.OpenAsync(Ct);
        await using var command = new NpgsqlCommand(sql, connection);
        return Convert.ToInt64(await command.ExecuteScalarAsync(Ct), System.Globalization.CultureInfo.InvariantCulture);
    }

    private static SiteEvent StopOpened()
    {
        using var doc = JsonDocument.Parse("""{"stop":"profile"}""");
        return new SiteEvent(
            Guid.CreateVersion7(), EventTypes.StopOpened, Noon, Noon, "hash", Langs.En, Themes.Day, Devices.Desktop,
            doc.RootElement.Clone());
    }

    /// <summary>Сбой между <c>MarkProcessed</c> и <c>Commit</c>.</summary>
    private sealed class FailingStatsRepository : IStatsRepository
    {
        public Task ApplyDeltasAsync(IReadOnlyCollection<StatsDelta> deltas, CancellationToken cancellationToken) =>
            throw new InvalidOperationException("Injected failure after MarkProcessed");

        public Task TruncateAllAsync(CancellationToken cancellationToken) => throw new NotSupportedException();
    }
}
