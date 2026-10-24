using System.Text.Json;
using BuildingBlocks.Http;
using EventsApi.Application.IngestEvents;
using Microsoft.AspNetCore.Mvc;

namespace EventsApi.Api;

/// <summary>
/// <c>POST /api/events</c> (design §5.3): body ≤ 16 KB → <see cref="IngestEventsHandler"/>. 202 accepted,
/// 400 with errors by path, 413 too large, 503 when the event log is unavailable.
/// </summary>
public static class EventsEndpoint
{
    public const int MaxBodyBytes = 16 * 1024;

    public static IEndpointRouteBuilder MapEventsEndpoint(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        // Kestrel отрежет тело сам; RequestBodyReader — для хостов без IHttpMaxRequestBodySizeFeature
        app.MapGroup("/api/events")
            .MapPost("", PostAsync)
            .WithMetadata(new RequestSizeLimitAttribute(MaxBodyBytes));
        return app;
    }

    private static async Task<IResult> PostAsync(
        HttpRequest request,
        IngestEventsHandler handler,
        CancellationToken cancellationToken)
    {
        var body = await RequestBodyReader.ReadAsync(request, MaxBodyBytes, cancellationToken);
        if (body.Status == BodyReadStatus.TooLarge)
        {
            return HttpProblems.PayloadTooLarge(MaxBodyBytes);
        }

        JsonDocument document;
        try
        {
            document = JsonDocument.Parse(body.Body);
        }
        catch (JsonException)
        {
            return HttpProblems.BadRequest("Malformed JSON");
        }

        using (document)
        {
            var result = await handler.HandleAsync(
                new IngestEventsCommand(document.RootElement, request.Headers.UserAgent), cancellationToken);
            return result switch
            {
                IngestEventsResult.Accepted => Results.Accepted(),
                IngestEventsResult.ValidationFailed failed => HttpProblems.Validation(failed.Errors),
                IngestEventsResult.PublishFailed => HttpProblems.ServiceUnavailable("Event log unavailable"),
                _ => throw new InvalidOperationException($"Unexpected result {result.GetType().Name}."),
            };
        }
    }
}
