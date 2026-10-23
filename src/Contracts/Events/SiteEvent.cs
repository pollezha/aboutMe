using System.Text.Json;
using System.Text.Json.Serialization;

namespace Contracts.Events;

/// <summary>
/// Event in <see cref="Topics.SiteEvents"/> (design §5.4). events-api builds it from a valid
/// <see cref="IncomingEvent"/>: the session id is replaced by its hash, <c>receivedAt</c> and <c>device</c>
/// are set by the server. Evolution: only new optional fields.
/// </summary>
public sealed record SiteEvent(
    Guid EventId,
    string Type,
    [property: JsonConverter(typeof(UtcDateTimeOffsetConverter))] DateTimeOffset OccurredAt,
    [property: JsonConverter(typeof(UtcDateTimeOffsetConverter))] DateTimeOffset ReceivedAt,
    string SessionHash,
    string Lang,
    string Theme,
    string Device,
    JsonElement Payload);
