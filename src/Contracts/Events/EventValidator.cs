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
        [EventTypes.StopOpened] = [new("stop", OneOf(Stops.All))],
        [EventTypes.SkillOpened] = [new("skill", SkillName)],
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
        else if (!IsPlainText(sessionId))
        {
            errors.Add(new("sessionId", "Must not contain control characters or unpaired surrogates."));
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
        // Свой словарь вместо TryGetProperty: тот разэкранирует все имена и бросает на непарном суррогате
        var values = new Dictionary<string, JsonElement>(StringComparer.Ordinal);
        foreach (var property in element.EnumerateObject())
        {
            if (ReadName(property) is not { } name)
            {
                errors.Add(new("payload", "Field names must be valid text."));
                return;
            }

            values[name] = property.Value;
            if (!Array.Exists(fields, f => f.Name == name))
            {
                errors.Add(new($"payload.{name}", $"Unknown field for '{type}'."));
            }
        }

        foreach (var field in fields)
        {
            var message = values.TryGetValue(field.Name, out var value) ? field.Check(value) : "Required.";
            if (message is not null)
            {
                errors.Add(new($"payload.{field.Name}", message));
            }
        }
    }

    private static Func<JsonElement, string?> OneOf(IReadOnlyList<string> allowed) =>
        value => ReadString(value) is { } s && allowed.Contains(s, StringComparer.Ordinal)
            ? null
            : $"Must be one of: {string.Join(", ", allowed)}.";

    /// <summary>
    /// <c>skill_opened.skill</c>: a tech stack server name ("C# / .NET", "ASP.NET Core") — letters, digits, spaces and
    /// <c>. + # / _ -</c>, no leading or trailing spaces, 1 to <see cref="EventLimits.SkillMaxLength"/> characters.
    /// </summary>
    private static string? SkillName(JsonElement value) =>
        NonEmptyString(value, EventLimits.SkillMaxLength) is { } s && s.Trim().Length == s.Length && s.All(IsSkillChar)
            ? null
            : $"Must be 1 to {EventLimits.SkillMaxLength} letters, digits, spaces or '. + # / _ -' without surrounding spaces.";

    private static bool IsSkillChar(char c) => char.IsLetterOrDigit(c) || c is ' ' or '.' or '+' or '#' or '/' or '_' or '-';

    /// <summary>Non-empty string of plain text (see <see cref="IsPlainText"/>) up to <paramref name="maxLength"/>, otherwise null.</summary>
    private static string? NonEmptyString(JsonElement value, int maxLength) =>
        ReadString(value) is { Length: > 0 } s && s.Length <= maxLength && IsPlainText(s) ? s : null;

    /// <summary>
    /// String value of the element, or null when it is not a string. A JSON escape with an unpaired surrogate
    /// (<c>"\ud800"</c>) cannot be transcoded and makes <see cref="JsonElement.GetString"/> throw — that is bad input too.
    /// </summary>
    private static string? ReadString(JsonElement value)
    {
        if (value.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        try
        {
            return value.GetString();
        }
        catch (InvalidOperationException)
        {
            return null;
        }
    }

    /// <summary>Property name, or null when it is an escape with an unpaired surrogate (see <see cref="ReadString"/>).</summary>
    private static string? ReadName(JsonProperty property)
    {
        try
        {
            return property.Name;
        }
        catch (InvalidOperationException)
        {
            return null;
        }
    }

    /// <summary>
    /// No control characters (PostgreSQL rejects NUL in text) and no unpaired UTF-16 surrogates (not encodable as UTF-8).
    /// </summary>
    private static bool IsPlainText(string s)
    {
        for (var i = 0; i < s.Length; i++)
        {
            var c = s[i];
            if (char.IsControl(c) || char.IsLowSurrogate(c))
            {
                return false;
            }

            if (char.IsHighSurrogate(c))
            {
                if (i + 1 >= s.Length || !char.IsLowSurrogate(s[i + 1]))
                {
                    return false;
                }

                i++;
            }
        }

        return true;
    }

    private static string? NonNegativeNumber(JsonElement value) =>
        value.ValueKind == JsonValueKind.Number && value.TryGetDouble(out var number) && double.IsFinite(number) && number >= 0
            ? null
            : "Must be a non-negative number.";

    private sealed record PayloadField(string Name, Func<JsonElement, string?> Check);
}
