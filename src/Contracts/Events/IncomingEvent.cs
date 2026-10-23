using System.Text.Json;

namespace Contracts.Events;

/// <summary>
/// Event as sent by the browser to <c>POST /api/events</c>. Fields are nullable on purpose:
/// <see cref="EventValidator"/> reports every bad field by its path instead of failing on deserialization.
/// </summary>
public sealed record IncomingEvent(
    string? EventId,
    string? Type,
    DateTimeOffset? OccurredAt,
    string? SessionId,
    string? Lang,
    string? Theme,
    JsonElement? Payload);
