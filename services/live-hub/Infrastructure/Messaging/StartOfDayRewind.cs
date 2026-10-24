using Confluent.Kafka;

namespace LiveHub.Infrastructure.Messaging;

// Обработчик назначения партиций (SetPartitionsAssignedHandler): состояние live-hub после рестарта и ребаланса
// восстанавливается из журнала — партиции перематываются на первые сообщения текущих UTC-суток
// (OffsetsForTimes), повторы отсекает LiveState по eventId. Партиция без сегодняшних сообщений → Offset.End;
// ошибка запроса → Offset.Unset (коммит группы или latest).
public sealed partial class StartOfDayRewind(TimeProvider time, ILogger<StartOfDayRewind> logger)
{
    private static readonly TimeSpan OffsetsForTimesTimeout = TimeSpan.FromSeconds(10);

    public IEnumerable<TopicPartitionOffset> Rewind(
        IConsumer<string, string> consumer, IReadOnlyCollection<TopicPartition> partitions)
    {
        ArgumentNullException.ThrowIfNull(consumer);
        ArgumentNullException.ThrowIfNull(partitions);

        var startOfDay = time.GetUtcNow().UtcDateTime.Date;
        var timestamp = new Timestamp(DateTime.SpecifyKind(startOfDay, DateTimeKind.Utc));
        try
        {
            var offsets = consumer.OffsetsForTimes(
                partitions.Select(p => new TopicPartitionTimestamp(p, timestamp)), OffsetsForTimesTimeout);
            LogRewound(partitions.Count, startOfDay);
            return offsets.Select(o => new TopicPartitionOffset(o.TopicPartition, o.Offset));
        }
        catch (KafkaException ex)
        {
            LogRewindFailed(ex);
            return partitions.Select(p => new TopicPartitionOffset(p, Offset.Unset));
        }
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Rewound {PartitionCount} partitions to {StartOfDay:O}")]
    private partial void LogRewound(int partitionCount, DateTime startOfDay);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Rewind to the start of the day failed; reading from the committed offset")]
    private partial void LogRewindFailed(Exception exception);
}
