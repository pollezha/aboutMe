using Microsoft.EntityFrameworkCore;
using Npgsql;
using Projector.Application.Abstractions;
using Projector.Domain;

namespace Projector.Infrastructure.Persistence;

/// <summary>
/// Агрегаты <c>stats</c> через соединение <see cref="StatsDbContext"/>: UPSERT пачкой <see cref="NpgsqlBatch"/> в
/// текущей транзакции контекста (её открывает <c>EfUnitOfWork&lt;StatsDbContext&gt;</c>).
/// </summary>
public sealed class StatsRepository(StatsDbContext db) : IStatsRepository
{
    private const string UpsertDailyVisitSql = """
        INSERT INTO stats.daily_visits AS t (day, source, device, visits) VALUES ($1, $2, $3, $4)
        ON CONFLICT (day, source, device) DO UPDATE SET visits = t.visits + EXCLUDED.visits
        """;

    private const string UpsertStopOpenSql = """
        INSERT INTO stats.stop_opens AS t (day, stop, n) VALUES ($1, $2, $3)
        ON CONFLICT (day, stop) DO UPDATE SET n = t.n + EXCLUDED.n
        """;

    private const string UpsertCtaClickSql = """
        INSERT INTO stats.cta_clicks AS t (day, cta, source, n) VALUES ($1, $2, $3, $4)
        ON CONFLICT (day, cta, source) DO UPDATE SET n = t.n + EXCLUDED.n
        """;

    private const string UpsertWebVitalSql = """
        INSERT INTO stats.web_vitals AS t (day, name, bucket, n) VALUES ($1, $2, $3, $4)
        ON CONFLICT (day, name, bucket) DO UPDATE SET n = t.n + EXCLUDED.n
        """;

    public async Task ApplyDeltasAsync(IReadOnlyCollection<StatsDelta> deltas, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(deltas);

        if (deltas.Count == 0)
        {
            return;
        }

        await using var session = await StatsDbSession.OpenAsync(db, cancellationToken);
        await using var batch = new NpgsqlBatch(session.Connection, session.Transaction);
        foreach (var delta in deltas)
        {
            batch.BatchCommands.Add(ToCommand(delta));
        }

        await batch.ExecuteNonQueryAsync(cancellationToken);
    }

    public Task TruncateAllAsync(CancellationToken cancellationToken)
    {
        // Все таблицы модели (агрегаты и processed_events); история миграций в модель не входит
        var tables = db.Model.GetEntityTypes()
            .Select(e => $"\"{e.GetSchema()}\".\"{e.GetTableName()}\"")
            .Order(StringComparer.Ordinal);
        var sql = "TRUNCATE " + string.Join(", ", tables);
        return db.Database.ExecuteSqlRawAsync(sql, cancellationToken);
    }

    private static NpgsqlBatchCommand ToCommand(StatsDelta delta) => delta switch
    {
        DailyVisitDelta d => Command(UpsertDailyVisitSql, d.Day, d.Source, d.Device, d.N),
        StopOpenDelta d => Command(UpsertStopOpenSql, d.Day, d.Stop, d.N),
        CtaClickDelta d => Command(UpsertCtaClickSql, d.Day, d.Cta, d.Source, d.N),
        WebVitalDelta d => Command(UpsertWebVitalSql, d.Day, d.Name, d.Bucket, d.N),
        _ => throw new ArgumentOutOfRangeException(nameof(delta), delta.GetType().Name, "Unknown stats delta"),
    };

    private static NpgsqlBatchCommand Command(string sql, params object[] values)
    {
        var command = new NpgsqlBatchCommand(sql);
        foreach (var value in values)
        {
            command.Parameters.Add(new NpgsqlParameter { Value = value });
        }

        return command;
    }
}
