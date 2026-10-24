namespace BuildingBlocks.Persistence;

/// <summary>
/// Транзакция хранилища на один сценарий (ADR-0008): <see cref="BeginAsync"/> → работа репозиториев →
/// <see cref="CommitAsync"/>. <see cref="IAsyncDisposable.DisposeAsync"/> без Commit откатывает всё.
/// </summary>
public interface IUnitOfWork : IAsyncDisposable
{
    /// <summary>Открывает транзакцию; если она уже открыта — <see cref="InvalidOperationException"/>.</summary>
    Task BeginAsync(CancellationToken cancellationToken);

    /// <summary>Фиксирует открытую транзакцию; без <see cref="BeginAsync"/> — <see cref="InvalidOperationException"/>.</summary>
    Task CommitAsync(CancellationToken cancellationToken);
}
