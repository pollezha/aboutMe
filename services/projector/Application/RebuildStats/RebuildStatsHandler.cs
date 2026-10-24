using BuildingBlocks.Persistence;
using Projector.Application.Abstractions;

namespace Projector.Application.RebuildStats;

/// <summary>
/// Пересчёт агрегатов из журнала (design §5.5, команда <c>rebuild</c>): сброс офсетов группы на начало и очистка
/// таблиц <c>stats</c>. Следующий запуск projector прочитает топик с начала (<c>auto.offset.reset=earliest</c>).
/// </summary>
public sealed class RebuildStatsHandler(IConsumerOffsets offsets, IStatsRepository stats, IUnitOfWork unitOfWork)
{
    public async Task<RebuildStatsResult> HandleAsync(RebuildStatsCommand command, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        ArgumentException.ThrowIfNullOrEmpty(command.ConsumerGroup);

        // Сначала офсеты: если группа активна, данные не трогаем. Если упадёт очистка — повторный запуск
        // безопасен: projector с начала журнала только пропустит уже отмеченные события.
        if (!await offsets.ResetToBeginningAsync(command.ConsumerGroup, cancellationToken))
        {
            return RebuildStatsResult.GroupActive;
        }

        await unitOfWork.BeginAsync(cancellationToken);
        await stats.TruncateAllAsync(cancellationToken);
        await unitOfWork.CommitAsync(cancellationToken);
        return RebuildStatsResult.Done;
    }
}
