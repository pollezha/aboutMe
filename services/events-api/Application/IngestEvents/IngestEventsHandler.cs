using System.Text.Json;
using Contracts.Events;
using EventsApi.Application.Abstractions;
using EventsApi.Domain;
using Microsoft.Extensions.Logging;

namespace EventsApi.Application.IngestEvents;

/// <summary>
/// Accepts one event or a batch of up to <see cref="MaxBatchSize"/> <c>web_vital</c> events (design §5.3). Any
/// invalid event rejects the whole request; accepted events are anonymized and written to the event log.
/// </summary>
public sealed partial class IngestEventsHandler(
    EventValidator validator,
    IDailySalt dailySalt,
    IEventPublisher publisher,
    TimeProvider timeProvider,
    ILogger<IngestEventsHandler> logger)
{
    public const int MaxBatchSize = 20;

    private const string RootPath = "$";

    public async Task<IngestEventsResult> HandleAsync(IngestEventsCommand command, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        var parsed = Parse(command.Body);
        if (parsed.Errors.Count > 0)
        {
            return new IngestEventsResult.ValidationFailed(parsed.Errors
                .GroupBy(e => e.Path, StringComparer.Ordinal)
                .ToDictionary(g => g.Key, g => g.Select(e => e.Message).ToArray(), StringComparer.Ordinal));
        }

        var receivedAt = timeProvider.GetUtcNow();
        var device = DeviceClass.FromUserAgent(command.UserAgent);
        var salt = dailySalt.GetCurrent();
        var events = parsed.Events.Select(incoming => ToSiteEvent(incoming, receivedAt, device, salt.Span)).ToList();

        try
        {
            await Task.WhenAll(events.Select(e => publisher.PublishAsync(e, cancellationToken)));
        }
        catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
        {
            LogEventLogUnavailable(ex.GetType().Name, events.Count);
            return new IngestEventsResult.PublishFailed();
        }

        return new IngestEventsResult.Accepted();
    }

    private ParseResult Parse(JsonElement root)
    {
        var result = new ParseResult();
        switch (root.ValueKind)
        {
            case JsonValueKind.Object:
                ParseEvent(root, index: null, result);
                break;

            case JsonValueKind.Array:
                var count = root.GetArrayLength();
                if (count is 0 or > MaxBatchSize)
                {
                    result.Errors.Add(new(RootPath, $"A batch must contain 1 to {MaxBatchSize} events."));
                    break;
                }

                var index = 0;
                foreach (var element in root.EnumerateArray())
                {
                    ParseEvent(element, index++, result);
                }

                break;

            default:
                result.Errors.Add(new(RootPath, "Must be an event object or an array of events."));
                break;
        }

        return result;
    }

    private void ParseEvent(JsonElement element, int? index, ParseResult result)
    {
        IncomingEvent? incoming;
        try
        {
            incoming = element.Deserialize(SiteEventJsonContext.Default.IncomingEvent);
        }
        catch (JsonException ex)
        {
            // ex.Path — "$.occurredAt" и т. п.; поле неверного JSON-типа
            var field = ex.Path is { Length: > 2 } path && path.StartsWith("$.", StringComparison.Ordinal) ? path[2..] : null;
            result.Errors.Add(new(PathOf(index, field), "Has an invalid JSON type."));
            return;
        }

        if (incoming is null)
        {
            result.Errors.Add(new(PathOf(index, null), "Must be an event object."));
            return;
        }

        foreach (var error in validator.Validate(incoming))
        {
            result.Errors.Add(error with { Path = PathOf(index, error.Path) });
        }

        if (index is not null && incoming.Type is not null && incoming.Type != EventTypes.WebVital)
        {
            result.Errors.Add(new(PathOf(index, "type"), $"Only '{EventTypes.WebVital}' events can be sent in a batch."));
        }

        result.Events.Add(incoming);
    }

    private static string PathOf(int? index, string? field) => (index, field) switch
    {
        (null, null) => RootPath,
        (null, _) => field,
        (_, null) => $"[{index}]",
        _ => $"[{index}].{field}",
    };

    private static SiteEvent ToSiteEvent(IncomingEvent incoming, DateTimeOffset receivedAt, string device, ReadOnlySpan<byte> salt) =>
        new(
            Guid.Parse(incoming.EventId!),
            incoming.Type!,
            incoming.OccurredAt!.Value,
            receivedAt,
            Anonymizer.Hash(incoming.SessionId!, salt),
            incoming.Lang!,
            incoming.Theme!,
            device,
            incoming.Payload!.Value.Clone());

    [LoggerMessage(Level = LogLevel.Warning, Message = "Event log unavailable ({ErrorType}), {Count} event(s) dropped")]
    private partial void LogEventLogUnavailable(string errorType, int count);

    private sealed class ParseResult
    {
        public List<IncomingEvent> Events { get; } = [];

        public List<ValidationError> Errors { get; } = [];
    }
}
