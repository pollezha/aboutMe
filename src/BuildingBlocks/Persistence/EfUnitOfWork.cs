using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace BuildingBlocks.Persistence;

/// <summary>
/// <see cref="IUnitOfWork"/> поверх транзакции соединения <typeparamref name="TDbContext"/> (не SaveChanges):
/// всё, что репозитории делают через тот же контекст — change tracker, ExecuteSql, ExecuteUpdate, — попадает в неё.
/// Регистрируется scoped вместе с контекстом.
/// </summary>
public sealed class EfUnitOfWork<TDbContext>(TDbContext context) : IUnitOfWork
    where TDbContext : DbContext
{
    private IDbContextTransaction? _transaction;

    public async Task BeginAsync(CancellationToken cancellationToken)
    {
        if (_transaction is not null)
        {
            throw new InvalidOperationException("The unit of work already has an open transaction.");
        }

        _transaction = await context.Database.BeginTransactionAsync(cancellationToken);
    }

    public async Task CommitAsync(CancellationToken cancellationToken)
    {
        var transaction = _transaction
            ?? throw new InvalidOperationException("BeginAsync must be called before CommitAsync.");

        await transaction.CommitAsync(cancellationToken);
        _transaction = null;
        await transaction.DisposeAsync();
    }

    /// <summary>Незафиксированная транзакция откатывается; трекер очищается, чтобы не врать об откаченных строках.</summary>
    public async ValueTask DisposeAsync()
    {
        if (_transaction is null)
        {
            return;
        }

        var transaction = _transaction;
        _transaction = null;
        await transaction.DisposeAsync();
        context.ChangeTracker.Clear();
    }
}
