using System.Text.Json;
using Contracts.Events;

namespace Projector.Domain;

/// <summary>Чистые функции: событие → приращения агрегатов (docs/design/architecture.md §5.5).</summary>
public static class Aggregator
{
    /// <summary>Источник CTA-клика, если событие его не несёт (в контракте v1 поля нет).</summary>
    public const string UnknownSource = "unknown";

    /// <summary>
    /// Приращение агрегата от одного события; null — у события нет агрегата (неизвестный тип, нет нужного поля).
    /// День — UTC-дата <c>occurredAt</c>.
    /// </summary>
    public static StatsDelta? ToDelta(SiteEvent siteEvent)
    {
        ArgumentNullException.ThrowIfNull(siteEvent);

        var day = DateOnly.FromDateTime(siteEvent.OccurredAt.UtcDateTime);
        var payload = siteEvent.Payload;
        return siteEvent.Type switch
        {
            EventTypes.Visit => new DailyVisitDelta(day, GetString(payload, "source") ?? UnknownSource, siteEvent.Device, 1),
            EventTypes.StopOpened => GetString(payload, "stop") is { } stop ? new StopOpenDelta(day, stop, 1) : null,
            EventTypes.CtaClick => GetString(payload, "cta") is { } cta
                ? new CtaClickDelta(day, cta, GetString(payload, "source") ?? UnknownSource, 1)
                : null,
            EventTypes.WebVital => ToWebVital(day, payload),
            // skill_opened: агрегат появится позже — событие отмечается обработанным, схема stats не меняется
            _ => null,
        };
    }

    /// <summary>Приращения батча, свёрнутые по ключу строки (одна строка — одно приращение с суммой).</summary>
    public static IReadOnlyList<StatsDelta> Aggregate(IEnumerable<SiteEvent> events)
    {
        ArgumentNullException.ThrowIfNull(events);

        return events
            .Select(ToDelta)
            .OfType<StatsDelta>()
            .GroupBy(delta => delta with { N = 0 })
            .Select(group => group.Key with { N = group.Sum(delta => delta.N) })
            .ToList();
    }

    private static WebVitalDelta? ToWebVital(DateOnly day, JsonElement payload)
    {
        if (GetString(payload, "name") is not { } name
            || payload.ValueKind != JsonValueKind.Object
            || !payload.TryGetProperty("value", out var value)
            || value.ValueKind != JsonValueKind.Number
            || VitalBuckets.Bucket(name, value.GetDouble()) is not { } bucket)
        {
            return null;
        }

        return new WebVitalDelta(day, name, bucket, 1);
    }

    private static string? GetString(JsonElement payload, string property) =>
        payload.ValueKind == JsonValueKind.Object
        && payload.TryGetProperty(property, out var value)
        && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;
}
