using System.Text.Json;
using Confluent.Kafka;
using Contracts.Events;

namespace Projector.Infrastructure.Messaging;

/// <summary>Сообщение Kafka → <see cref="SiteEvent"/>; null — ядовитое (пустое, не JSON, без типа или eventId).</summary>
public static class SiteEventDeserializer
{
    public static SiteEvent? Deserialize(ConsumeResult<string, string> result)
    {
        ArgumentNullException.ThrowIfNull(result);

        var value = result.Message?.Value;
        if (string.IsNullOrEmpty(value))
        {
            return null;
        }

        try
        {
            var siteEvent = JsonSerializer.Deserialize(value, SiteEventJsonContext.Default.SiteEvent);
            return siteEvent is { Type: not null } && siteEvent.EventId != Guid.Empty ? siteEvent : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
