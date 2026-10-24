using System.Diagnostics;

namespace BuildingBlocks.Messaging.Kafka;

/// <summary>
/// Десериализованные сообщения батча (ядовитые уже отброшены) и ссылки на их спаны <c>process</c> —
/// обработчик может открыть свой спан с этими links (например, «project batch» в projector).
/// </summary>
public sealed class KafkaBatch<TMessage>(IReadOnlyList<TMessage> messages, IReadOnlyList<ActivityLink> links)
    where TMessage : class
{
    public IReadOnlyList<TMessage> Messages { get; } = messages;

    public IReadOnlyList<ActivityLink> Links { get; } = links;
}
