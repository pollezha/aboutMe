using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;

namespace Projector.Infrastructure.Persistence;

/// <summary>
/// Соединение и текущая транзакция <see cref="StatsDbContext"/> для сырых команд Npgsql: так команды репозиториев
/// попадают в транзакцию unit of work. Соединение открывается через EF и закрывается им же (если его открыла
/// транзакция — остаётся открытым до её завершения).
/// </summary>
internal sealed class StatsDbSession : IAsyncDisposable
{
    private readonly StatsDbContext _db;

    private StatsDbSession(StatsDbContext db)
    {
        _db = db;
        Connection = (NpgsqlConnection)db.Database.GetDbConnection();
        Transaction = (NpgsqlTransaction?)db.Database.CurrentTransaction?.GetDbTransaction();
    }

    public NpgsqlConnection Connection { get; }

    public NpgsqlTransaction? Transaction { get; }

    public static async Task<StatsDbSession> OpenAsync(StatsDbContext db, CancellationToken cancellationToken)
    {
        await db.Database.OpenConnectionAsync(cancellationToken);
        return new StatsDbSession(db);
    }

    public async ValueTask DisposeAsync() => await _db.Database.CloseConnectionAsync();
}
