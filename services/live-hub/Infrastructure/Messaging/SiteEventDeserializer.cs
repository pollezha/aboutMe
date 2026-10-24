using System.Text.Json;
using Confluent.Kafka;
using Contracts.Events;

namespace LiveHub.Infrastructure.Messaging;

// Тело сообщения site.events.v1 → SiteEvent. null (или исключение) — ядовитое сообщение: KafkaConsumerLoop
// считает его в live_poison_total и пропускает.
public static class SiteEventDeserializer
{
    public static SiteEvent? Deserialize(ConsumeResult<string, string> result)
    {
        ArgumentNullException.ThrowIfNull(result);

        var siteEvent = JsonSerializer.Deserialize(result.Message.Value, SiteEventJsonContext.Default.SiteEvent);
        return siteEvent is { Type: not null, SessionHash: not null } && siteEvent.EventId != Guid.Empty
            ? siteEvent
            : null;
    }
}
