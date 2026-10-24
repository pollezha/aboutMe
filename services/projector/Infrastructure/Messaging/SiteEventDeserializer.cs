using System.Diagnostics.CodeAnalysis;
using System.Text.Json;
using Confluent.Kafka;
using Contracts.Events;

namespace Projector.Infrastructure.Messaging;

/// <summary>Сообщение Kafka → <see cref="SiteEvent"/>; null — ядовитое (пустое, не JSON, без обязательных полей).</summary>
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
            return IsComplete(siteEvent) ? siteEvent : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>
    /// Поля, без которых событие не спроецировать (NOT NULL в <c>stats</c>, сутки по <c>occurredAt</c>). Сообщение,
    /// записанное мимо events-api без них, иначе падало бы в БД на каждой попытке.
    /// </summary>
    private static bool IsComplete([NotNullWhen(true)] SiteEvent? siteEvent) =>
        siteEvent is { Type: not null, SessionHash: not null, Device: not null }
        && siteEvent.EventId != Guid.Empty
        && siteEvent.OccurredAt != default;
}
