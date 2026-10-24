using Contracts.Events;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using NpgsqlTypes;
using Projector.Data;

namespace Projector.Projection;

/// <summary>
/// Запись батча событий в одной транзакции: отметки <c>processed_events</c> и UPSERT агрегатов только для
/// событий, которых ещё не было (ADR-0002, design §5.5). Повторная доставка ⇒ ON CONFLICT ⇒ агрегат не меняется.
/// </summary>
public static class StatsWriter
{
    private const string MarkProcessedSql = """
        INSERT INTO stats.processed_events (event_id) SELECT unnest($1)
        ON CONFLICT DO NOTHING
        RETURNING event_id
        """;

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

    /// <returns>Число новых (ранее не обработанных) событий.</returns>
    public static async Task<int> WriteAsync(StatsDbContext db, IReadOnlyCollection<SiteEvent> events, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(db);
        ArgumentNullException.ThrowIfNull(events);

        if (events.Count == 0)
        {
            return 0;
        }

        // Дубль внутри одного батча тоже считается один раз
        var unique = events.DistinctBy(e => e.EventId).ToList();

        await db.Database.OpenConnectionAsync(cancellationToken);
        try
        {
            var connection = (NpgsqlConnection)db.Database.GetDbConnection();
            await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

            var fresh = await MarkProcessedAsync(connection, transaction, unique, cancellationToken);
            var deltas = Aggregator.Aggregate(unique.Where(e => fresh.Contains(e.EventId)));
            if (deltas.Count > 0)
            {
                await using var batch = new NpgsqlBatch(connection, transaction);
                foreach (var delta in deltas)
                {
                    batch.BatchCommands.Add(ToCommand(delta));
                }

                await batch.ExecuteNonQueryAsync(cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);
            return fresh.Count;
        }
        finally
        {
            await db.Database.CloseConnectionAsync();
        }
    }

    private static async Task<HashSet<Guid>> MarkProcessedAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, List<SiteEvent> events, CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(MarkProcessedSql, connection, transaction);
        command.Parameters.Add(new NpgsqlParameter<Guid[]>
        {
            NpgsqlDbType = NpgsqlDbType.Array | NpgsqlDbType.Uuid,
            TypedValue = [.. events.Select(e => e.EventId)],
        });

        var fresh = new HashSet<Guid>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            fresh.Add(reader.GetGuid(0));
        }

        return fresh;
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
