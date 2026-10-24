namespace BuildingBlocks.Messaging.Kafka;

/// <summary>
/// Настройки <see cref="KafkaConsumerLoop{TMessage}"/>. Projector: батч до 200 / 500 мс, ручной коммит;
/// live-hub: <see cref="MaxBatchSize"/> = 1 и автокоммит клиента (<see cref="CommitOffsets"/> = false).
/// </summary>
public sealed record KafkaConsumerLoopOptions
{
    public required string Topic { get; init; }

    /// <summary>Имя счётчика ядовитых сообщений в переданном <see cref="System.Diagnostics.Metrics.Meter"/>.</summary>
    public required string PoisonCounterName { get; init; }

    public int MaxBatchSize { get; init; } = 1;

    /// <summary>Сколько ждать добора батча после первого сообщения.</summary>
    public TimeSpan BatchWindow { get; init; } = TimeSpan.FromMilliseconds(500);

    /// <summary>Коммитить офсеты батча после успешного обработчика (для группы с enable.auto.commit = false).</summary>
    public bool CommitOffsets { get; init; } = true;

    public TimeSpan FirstRetryDelay { get; init; } = TimeSpan.FromSeconds(1);

    public TimeSpan MaxRetryDelay { get; init; } = TimeSpan.FromSeconds(30);
}
