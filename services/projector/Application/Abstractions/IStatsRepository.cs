using Projector.Domain;

namespace Projector.Application.Abstractions;

/// <summary>
/// Агрегаты схемы <c>stats</c>. Работает в транзакции текущего <see cref="BuildingBlocks.Persistence.IUnitOfWork"/>.
/// </summary>
public interface IStatsRepository
{
    /// <summary>Прибавляет приращения к строкам агрегатов (недостающая строка создаётся).</summary>
    Task ApplyDeltasAsync(IReadOnlyCollection<StatsDelta> deltas, CancellationToken cancellationToken);

    /// <summary>Очищает все агрегаты и отметки обработанных событий (пересчёт из журнала).</summary>
    Task TruncateAllAsync(CancellationToken cancellationToken);
}
