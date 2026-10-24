namespace Projector.Application.Abstractions;

/// <summary>Офсеты consumer group в журнале событий.</summary>
public interface IConsumerOffsets
{
    /// <summary>
    /// Сбрасывает офсеты группы на начало журнала. <c>false</c> — у группы есть активные участники, офсеты не тронуты.
    /// </summary>
    Task<bool> ResetToBeginningAsync(string consumerGroup, CancellationToken cancellationToken);
}
