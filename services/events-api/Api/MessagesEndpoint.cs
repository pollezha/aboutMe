using System.Text.Json;
using BuildingBlocks.Http;
using EventsApi.Application.SendContactMessage;
using Microsoft.AspNetCore.Mvc;

namespace EventsApi.Api;

/// <summary>
/// <c>POST /api/messages</c> — message in a bottle (FR17, design §5.3): body ≤ 4 KB → <see cref="SendContactMessageHandler"/>.
/// 202 delivered, 204 honeypot, 400 by field, 413 too large, 503 when delivery is unavailable.
/// </summary>
public static class MessagesEndpoint
{
    public const int MaxBodyBytes = 4 * 1024;

    public static IEndpointRouteBuilder MapMessagesEndpoint(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        app.MapGroup("/api/messages")
            .MapPost("", PostAsync)
            .WithMetadata(new RequestSizeLimitAttribute(MaxBodyBytes));
        return app;
    }

    private static async Task<IResult> PostAsync(
        HttpRequest request,
        SendContactMessageHandler handler,
        CancellationToken cancellationToken)
    {
        var body = await RequestBodyReader.ReadAsync(request, MaxBodyBytes, cancellationToken);
        if (body.Status == BodyReadStatus.TooLarge)
        {
            return HttpProblems.PayloadTooLarge(MaxBodyBytes);
        }

        MessageRequest? message;
        try
        {
            message = JsonSerializer.Deserialize(body.Body.Span, MessageRequestJsonContext.Default.MessageRequest);
        }
        catch (JsonException)
        {
            return HttpProblems.BadRequest("Malformed JSON");
        }

        if (message is null)
        {
            return HttpProblems.BadRequest("Malformed JSON");
        }

        var command = new SendContactMessageCommand(
            message.Name,
            message.ReplyTo,
            message.Text,
            message.Website,
            message.SessionId,
            message.Lang,
            message.Theme,
            request.Headers.UserAgent);
        var result = await handler.HandleAsync(command, cancellationToken);
        return result switch
        {
            SendContactMessageResult.Delivered => Results.Accepted(),
            SendContactMessageResult.Ignored => Results.NoContent(),
            SendContactMessageResult.ValidationFailed failed => HttpProblems.Validation(failed.Errors),
            SendContactMessageResult.DeliveryFailed => HttpProblems.ServiceUnavailable("Message delivery unavailable"),
            _ => throw new InvalidOperationException($"Unexpected result {result.GetType().Name}."),
        };
    }
}
