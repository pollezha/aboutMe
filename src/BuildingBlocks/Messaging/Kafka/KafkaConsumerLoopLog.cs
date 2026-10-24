using Confluent.Kafka;
using Microsoft.Extensions.Logging;

namespace BuildingBlocks.Messaging.Kafka;

/// <summary>Логи <see cref="KafkaConsumerLoop{TMessage}"/> (генератор LoggerMessage — в необобщённом классе).</summary>
internal static partial class KafkaConsumerLoopLog
{
    [LoggerMessage(Level = LogLevel.Warning, Message = "Poison message skipped: {Topic} [{Partition}] @{Offset}")]
    public static partial void Poison(ILogger logger, string topic, int partition, long offset);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Kafka consume failed: {ErrorCode} {Reason}")]
    public static partial void ConsumeFailed(ILogger logger, ErrorCode errorCode, string reason);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Kafka offset commit failed: {ErrorCode} {Reason}")]
    public static partial void CommitFailed(ILogger logger, ErrorCode errorCode, string reason);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Kafka consumer close failed: {ErrorCode} {Reason}")]
    public static partial void CloseFailed(ILogger logger, ErrorCode errorCode, string reason);

    [LoggerMessage(Level = LogLevel.Error,
        Message = "Handling of {Count} messages failed (attempt {Attempt}), retrying in {DelaySeconds} s")]
    public static partial void HandlerFailed(ILogger logger, Exception exception, int count, int attempt, double delaySeconds);
}
