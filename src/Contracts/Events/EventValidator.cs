using System.Text.Json;

namespace Contracts.Events;

/// <summary>
/// Checks an <see cref="IncomingEvent"/> against the <see cref="Topics.SiteEvents"/> contract. Never throws on bad
/// input: returns every violation with its JSON path (empty list = valid).
/// </summary>
public sealed class EventValidator(TimeProvider timeProvider)
{
    private const int UuidVersion7 = 7;

    private static readonly Dictionary<string, PayloadField[]> PayloadFields = new(StringComparer.Ordinal)
    {
        [EventTypes.Visit] = [new("source", OneOf(VisitSources.All))],
        [EventTypes.StopOpened] = [new("stop", NonEmptyString(EventLimits.StopMaxLength))],
        [EventTypes.SkillOpened] = [new("skill", NonEmptyString(EventLimits.SkillMaxLength))],
        [EventTypes.CtaClick] = [new("cta", OneOf(CtaTargets.All))],
        [EventTypes.WebVital] = [new("name", OneOf(WebVitalNames.All)), new("value", NonNegativeNumber)],
    };

    public IReadOnlyList<ValidationError> Validate(IncomingEvent incoming)
    {
        ArgumentNullException.ThrowIfNull(incoming);

        var errors = new List<ValidationError>();
        ValidateEventId(incoming.EventId, errors);
        var typeIsKnown = Check(errors, "type", incoming.Type, EventTypes.All);
        ValidateOccurredAt(incoming.OccurredAt, errors);
        ValidateSessionId(incoming.SessionId, errors);
        Check(errors, "lang", incoming.Lang, Langs.All);
        Check(errors, "theme", incoming.Theme, Themes.All);
        ValidatePayload(typeIsKnown ? incoming.Type! : null, incoming.Payload, errors);
        return errors;
    }

    private static void ValidateEventId(string? eventId, List<ValidationError> errors)
    {
        if (string.IsNullOrEmpty(eventId))
        {
            errors.Add(new("eventId", "Required."));
        }
        else if (!Guid.TryParseExact(eventId, "D", out var guid) || guid.Version != UuidVersion7)
        {
            errors.Add(new("eventId", "Must be a UUIDv7."));
        }
    }

    private void ValidateOccurredAt(DateTimeOffset? occurredAt, List<ValidationError> errors)
    {
        if (occurredAt is null)
        {
            errors.Add(new("occurredAt", "Required."));
        }
        else if ((occurredAt.Value - timeProvider.GetUtcNow()).Duration() > EventLimits.OccurredAtTolerance)
        {
            errors.Add(new("occurredAt", "Must be within 24 hours of server time."));
        }
    }

    private static void ValidateSessionId(string? sessionId, List<ValidationError> errors)
    {
        if (string.IsNullOrWhiteSpace(sessionId))
        {
            errors.Add(new("sessionId", "Required."));
        }
        else if (sessionId.Length > EventLimits.SessionIdMaxLength)
        {
            errors.Add(new("sessionId", $"Must be at most {EventLimits.SessionIdMaxLength} characters."));
        }
    }

    private static bool Check(List<ValidationError> errors, string path, string? value, IReadOnlyList<string> allowed)
    {
        if (string.IsNullOrEmpty(value))
        {
            errors.Add(new(path, "Required."));
            return false;
        }

        if (!allowed.Contains(value, StringComparer.Ordinal))
        {
            errors.Add(new(path, $"Must be one of: {string.Join(", ", allowed)}."));
            return false;
        }

        return true;
    }

    /// <param name="type">Event type, or null when it is invalid (then the payload shape is unknown).</param>
    private static void ValidatePayload(string? type, JsonElement? payload, List<ValidationError> errors)
    {
        if (payload is not { ValueKind: not (JsonValueKind.Null or JsonValueKind.Undefined) } element)
        {
            errors.Add(new("payload", "Required."));
            return;
        }

        if (element.ValueKind != JsonValueKind.Object)
        {
            errors.Add(new("payload", "Must be an object."));
            return;
        }

        if (type is null)
        {
            return;
        }

        var fields = PayloadFields[type];
        foreach (var property in element.EnumerateObject())
        {
            if (!Array.Exists(fields, f => f.Name == property.Name))
            {
                errors.Add(new($"payload.{property.Name}", $"Unknown field for '{type}'."));
            }
        }

        foreach (var field in fields)
        {
            var message = element.TryGetProperty(field.Name, out var value) ? field.Check(value) : "Required.";
            if (message is not null)
            {
                errors.Add(new($"payload.{field.Name}", message));
            }
        }
    }

    private static Func<JsonElement, string?> OneOf(IReadOnlyList<string> allowed) =>
        value => value.ValueKind == JsonValueKind.String && allowed.Contains(value.GetString(), StringComparer.Ordinal)
            ? null
            : $"Must be one of: {string.Join(", ", allowed)}.";

    private static Func<JsonElement, string?> NonEmptyString(int maxLength) =>
        value => value.ValueKind == JsonValueKind.String && value.GetString() is { Length: > 0 } s && s.Length <= maxLength
            ? null
            : $"Must be a non-empty string of at most {maxLength} characters.";

    private static string? NonNegativeNumber(JsonElement value) =>
        value.ValueKind == JsonValueKind.Number && value.TryGetDouble(out var number) && double.IsFinite(number) && number >= 0
            ? null
            : "Must be a non-negative number.";

    private sealed record PayloadField(string Name, Func<JsonElement, string?> Check);
}
