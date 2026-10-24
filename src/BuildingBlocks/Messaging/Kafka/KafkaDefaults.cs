using Confluent.Kafka;

namespace BuildingBlocks.Messaging.Kafka;

// Общий конфиг Kafka-клиентов (ADR-0002, docs/design/architecture.md §5.3–5.6).
// Apply* дописывают политику в уже собранный конфиг (например, из connection string Aspire),
// Create* — то же для конфига с нуля.
public static class KafkaDefaults
{
    // Kafka недоступна дольше 2 с → events-api отвечает 503 (событие теряется, best effort).
    public const int DeliveryTimeoutMs = 2000;

    // Небольшое окно батчинга: события мелкие и редкие, задержка важнее пропускной способности.
    public const int LingerMs = 5;

    public static ProducerConfig ApplyProducerDefaults(ProducerConfig config)
    {
        ArgumentNullException.ThrowIfNull(config);

        config.Acks = Acks.All;
        config.EnableIdempotence = true;
        // message.timeout.ms в librdkafka — это и есть delivery.timeout.ms (синоним)
        config.MessageTimeoutMs = DeliveryTimeoutMs;
        config.LingerMs = LingerMs;
        return config;
    }

    public static ProducerConfig CreateProducerConfig(string bootstrapServers)
    {
        ArgumentException.ThrowIfNullOrEmpty(bootstrapServers);

        return ApplyProducerDefaults(new ProducerConfig { BootstrapServers = bootstrapServers });
    }

    // projector коммитит offset сам после транзакции в БД (enableAutoCommit: false);
    // live-hub может читать с конца и коммитить автоматически.
    public static ConsumerConfig ApplyConsumerDefaults(
        ConsumerConfig config,
        string groupId,
        bool enableAutoCommit = false,
        AutoOffsetReset autoOffsetReset = AutoOffsetReset.Earliest)
    {
        ArgumentNullException.ThrowIfNull(config);
        ArgumentException.ThrowIfNullOrEmpty(groupId);

        config.GroupId = groupId;
        config.EnableAutoCommit = enableAutoCommit;
        config.AutoOffsetReset = autoOffsetReset;
        return config;
    }

    public static ConsumerConfig CreateConsumerConfig(
        string bootstrapServers,
        string groupId,
        bool enableAutoCommit = false,
        AutoOffsetReset autoOffsetReset = AutoOffsetReset.Earliest)
    {
        ArgumentException.ThrowIfNullOrEmpty(bootstrapServers);

        return ApplyConsumerDefaults(
            new ConsumerConfig { BootstrapServers = bootstrapServers },
            groupId,
            enableAutoCommit,
            autoOffsetReset);
    }
}
