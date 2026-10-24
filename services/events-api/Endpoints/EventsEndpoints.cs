using System.Text.Json;
using Contracts.Events;
using Microsoft.AspNetCore.Mvc;

namespace EventsApi.Endpoints;

/// <summary>
/// <c>POST /api/events</c> (design §5.3): one event or a batch of up to 20 <c>web_vital</c> events, body ≤ 16 KB.
/// Any invalid event rejects the whole request (400 with errors by path, <c>[i].field</c> for batches);
/// accepted events are anonymized and written to the event log (202), log unavailable → 503.
/// </summary>
public static partial class EventsEndpoints
{
    public const int MaxBodyBytes = 16 * 1024;
    public const int MaxBatchSize = 20;

    private const string RootPath = "$";

    public static IEndpointRouteBuilder MapEventsEndpoints(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        // Kestrel отрежет тело сам; ручная проверка ниже — для хостов без IHttpMaxRequestBodySizeFeature
        app.MapPost("/api/events", PostEventsAsync)
            .WithMetadata(new RequestSizeLimitAttribute(MaxBodyBytes));
        return app;
    }

    private static async Task<IResult> PostEventsAsync(
        HttpRequest request,
        EventValidator validator,
        Anonymizer anonymizer,
        IEventProducer producer,
        TimeProvider timeProvider,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        var body = await ReadBodyAsync(request, cancellationToken);
        if (body is null)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status413PayloadTooLarge,
                title: "Request body too large",
                detail: $"The body must be at most {MaxBodyBytes} bytes.");
        }

        JsonDocument document;
        try
        {
            document = JsonDocument.Parse(body);
        }
        catch (JsonException)
        {
            return Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "Malformed JSON");
        }

        using (document)
        {
            var parsed = Parse(document.RootElement, validator);
            if (parsed.Errors.Count > 0)
            {
                return Results.ValidationProblem(parsed.Errors
                    .GroupBy(e => e.Path, StringComparer.Ordinal)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.Message).ToArray(), StringComparer.Ordinal));
            }

            var receivedAt = timeProvider.GetUtcNow();
            var device = DeviceClass.FromUserAgent(request.Headers.UserAgent);
            var events = parsed.Events.Select(incoming => ToSiteEvent(incoming, receivedAt, device, anonymizer)).ToList();

            try
            {
                await Task.WhenAll(events.Select(e => producer.ProduceAsync(e, cancellationToken)));
            }
            catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
            {
                LogEventLogUnavailable(loggerFactory.CreateLogger(typeof(EventsEndpoints)), ex.GetType().Name, events.Count);
                return Results.Problem(statusCode: StatusCodes.Status503ServiceUnavailable, title: "Event log unavailable");
            }
        }

        return Results.Accepted();
    }

    /// <returns>Body bytes, or null when the body is larger than <see cref="MaxBodyBytes"/>.</returns>
    private static async Task<byte[]?> ReadBodyAsync(HttpRequest request, CancellationToken cancellationToken)
    {
        if (request.ContentLength > MaxBodyBytes)
        {
            return null;
        }

        using var buffer = new MemoryStream();
        var chunk = new byte[4096];
        try
        {
            int read;
            while ((read = await request.Body.ReadAsync(chunk, cancellationToken)) > 0)
            {
                if (buffer.Length + read > MaxBodyBytes)
                {
                    return null;
                }

                buffer.Write(chunk, 0, read);
            }
        }
        catch (BadHttpRequestException ex) when (ex.StatusCode == StatusCodes.Status413PayloadTooLarge)
        {
            return null;
        }

        return buffer.ToArray();
    }

    private static ParseResult Parse(JsonElement root, EventValidator validator)
    {
        var result = new ParseResult();
        switch (root.ValueKind)
        {
            case JsonValueKind.Object:
                ParseEvent(root, index: null, validator, result);
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
                    ParseEvent(element, index++, validator, result);
                }

                break;

            default:
                result.Errors.Add(new(RootPath, "Must be an event object or an array of events."));
                break;
        }

        return result;
    }

    private static void ParseEvent(JsonElement element, int? index, EventValidator validator, ParseResult result)
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

    private static SiteEvent ToSiteEvent(IncomingEvent incoming, DateTimeOffset receivedAt, string device, Anonymizer anonymizer) =>
        new(
            Guid.Parse(incoming.EventId!),
            incoming.Type!,
            incoming.OccurredAt!.Value,
            receivedAt,
            anonymizer.Hash(incoming.SessionId!),
            incoming.Lang!,
            incoming.Theme!,
            device,
            incoming.Payload!.Value.Clone());

    [LoggerMessage(Level = LogLevel.Warning, Message = "Event log unavailable ({ErrorType}), {Count} event(s) dropped")]
    private static partial void LogEventLogUnavailable(ILogger logger, string errorType, int count);

    private sealed class ParseResult
    {
        public List<IncomingEvent> Events { get; } = [];

        public List<ValidationError> Errors { get; } = [];
    }
}
