namespace BuildingBlocks.Messaging.Kafka;

/// <summary>
/// Обработчик батча из <see cref="KafkaConsumerLoop{TMessage}"/>. Исключение = неуспех: офсеты батча не
/// коммитятся, батч повторяется с паузой. Обработчик должен быть идемпотентным (повторная доставка).
/// </summary>
public interface IKafkaMessageHandler<TMessage>
    where TMessage : class
{
    Task HandleAsync(KafkaBatch<TMessage> batch, CancellationToken cancellationToken);
}
