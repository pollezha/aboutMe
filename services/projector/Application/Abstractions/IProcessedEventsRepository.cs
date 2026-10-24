namespace Projector.Application.Abstractions;

/// <summary>
/// Отметки обработанных событий (<c>stats.processed_events</c>) — основа идемпотентности projector (ADR-0002).
/// Работает в транзакции текущего <see cref="BuildingBlocks.Persistence.IUnitOfWork"/>.
/// </summary>
public interface IProcessedEventsRepository
{
    /// <summary>Отмечает события обработанными и возвращает те из них, которых раньше не было.</summary>
    Task<IReadOnlySet<Guid>> MarkProcessedAsync(IReadOnlyCollection<Guid> eventIds, CancellationToken cancellationToken);
}
