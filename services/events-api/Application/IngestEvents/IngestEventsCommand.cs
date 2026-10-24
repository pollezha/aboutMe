using System.Text.Json;

namespace EventsApi.Application.IngestEvents;

/// <summary>
/// Parsed JSON body of <c>POST /api/events</c> (one event object or a batch array, not yet validated) and the
/// client's <c>User-Agent</c> (only its device class goes further).
/// </summary>
public sealed record IngestEventsCommand(JsonElement Body, string? UserAgent);
