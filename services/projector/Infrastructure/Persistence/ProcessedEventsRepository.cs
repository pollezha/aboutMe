using Npgsql;
using NpgsqlTypes;
using Projector.Application.Abstractions;

namespace Projector.Infrastructure.Persistence;

/// <summary>
/// <c>stats.processed_events</c>: <c>INSERT … ON CONFLICT DO NOTHING RETURNING</c> в текущей транзакции
/// <see cref="StatsDbContext"/> — вернутся только id, которых ещё не было.
/// </summary>
public sealed class ProcessedEventsRepository(StatsDbContext db) : IProcessedEventsRepository
{
    private const string MarkProcessedSql = """
        INSERT INTO stats.processed_events (event_id) SELECT unnest($1)
        ON CONFLICT DO NOTHING
        RETURNING event_id
        """;

    public async Task<IReadOnlySet<Guid>> MarkProcessedAsync(IReadOnlyCollection<Guid> eventIds, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(eventIds);

        var fresh = new HashSet<Guid>();
        if (eventIds.Count == 0)
        {
            return fresh;
        }

        await using var session = await StatsDbSession.OpenAsync(db, cancellationToken);
        await using var command = new NpgsqlCommand(MarkProcessedSql, session.Connection, session.Transaction);
        command.Parameters.Add(new NpgsqlParameter<Guid[]>
        {
            NpgsqlDbType = NpgsqlDbType.Array | NpgsqlDbType.Uuid,
            TypedValue = [.. eventIds],
        });

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            fresh.Add(reader.GetGuid(0));
        }

        return fresh;
    }
}
