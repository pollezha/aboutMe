using System.Diagnostics;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Contracts.Events;
using EventsApi.Telegram;
using Microsoft.AspNetCore.Mvc;

namespace EventsApi.Endpoints;

/// <summary>
/// <c>POST /api/messages</c> — message in a bottle (FR17, design §5.3): forwarded to the owner's Telegram and
/// stored nowhere. Filled honeypot → 204 without sending; invalid → 400 by field; sent → 202 and, when the body
/// carries <c>sessionId</c>/<c>lang</c>/<c>theme</c>, a <c>cta_click{cta: bottle}</c> event (no message content);
/// Telegram unavailable → 503. Name, reply address and text never reach logs or spans (only their lengths).
/// </summary>
public static partial class MessagesEndpoints
{
    public const int MaxBodyBytes = 4 * 1024;
    public const int NameMaxLength = 80;
    public const int ReplyToMaxLength = 120;
    public const int TextMaxLength = 2000;

    public static IEndpointRouteBuilder MapMessagesEndpoints(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        app.MapPost("/api/messages", PostMessageAsync)
            .WithMetadata(new RequestSizeLimitAttribute(MaxBodyBytes));
        return app;
    }

    private static async Task<IResult> PostMessageAsync(
        HttpRequest request,
        TelegramClient telegram,
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

        MessageRequest? message;
        try
        {
            message = JsonSerializer.Deserialize(body, MessagesJsonContext.Default.MessageRequest);
        }
        catch (JsonException)
        {
            return Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "Malformed JSON");
        }

        if (message is null)
        {
            return Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "Malformed JSON");
        }

        if (!string.IsNullOrEmpty(message.Website))
        {
            return Results.NoContent();
        }

        var name = message.Name?.Trim() ?? "";
        var replyTo = message.ReplyTo?.Trim() ?? "";
        var text = message.Text?.Trim() ?? "";

        var activity = Activity.Current;
        activity?.SetTag("message.name_length", name.Length);
        activity?.SetTag("message.reply_to_length", replyTo.Length);
        activity?.SetTag("message.text_length", text.Length);

        var errors = Validate(name, replyTo, text);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var logger = loggerFactory.CreateLogger(typeof(MessagesEndpoints));
        try
        {
            await telegram.SendMessageAsync($"Bottle from {name} ({replyTo}):\n{text}", cancellationToken);
        }
        catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
        {
            LogDeliveryFailed(logger, ex.GetType().Name);
            return Results.Problem(statusCode: StatusCodes.Status503ServiceUnavailable, title: "Message delivery unavailable");
        }

        await ProduceBottleClickAsync(message, request, validator, anonymizer, producer, timeProvider, logger, cancellationToken);
        return Results.Accepted();
    }

    private static Dictionary<string, string[]> Validate(string name, string replyTo, string text)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        RequireLength(errors, "name", name, NameMaxLength);
        RequireLength(errors, "replyTo", replyTo, ReplyToMaxLength);
        RequireLength(errors, "text", text, TextMaxLength);

        if (!errors.ContainsKey("replyTo") && !Email().IsMatch(replyTo) && !TelegramUsername().IsMatch(replyTo))
        {
            errors["replyTo"] = ["Must be an email address or a Telegram @username."];
        }

        return errors;
    }

    private static void RequireLength(Dictionary<string, string[]> errors, string field, string value, int maxLength)
    {
        if (value.Length == 0)
        {
            errors[field] = ["Required."];
        }
        else if (value.Length > maxLength)
        {
            errors[field] = [$"Must be at most {maxLength} characters."];
        }
    }

    /// <summary>
    /// Analytics only: the event is skipped when the session fields are missing or invalid, and a broken event log
    /// does not affect the already delivered message.
    /// </summary>
    private static async Task ProduceBottleClickAsync(
        MessageRequest message,
        HttpRequest request,
        EventValidator validator,
        Anonymizer anonymizer,
        IEventProducer producer,
        TimeProvider timeProvider,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        if (message.SessionId is null)
        {
            return;
        }

        var now = timeProvider.GetUtcNow();
        using var payload = JsonSerializer.SerializeToDocument(
            new BottlePayload(CtaTargets.Bottle), MessagesJsonContext.Default.BottlePayload);
        var incoming = new IncomingEvent(
            Guid.CreateVersion7(now).ToString(),
            EventTypes.CtaClick,
            now,
            message.SessionId,
            message.Lang,
            message.Theme,
            payload.RootElement.Clone());
        if (validator.Validate(incoming).Count > 0)
        {
            return;
        }

        var siteEvent = new SiteEvent(
            Guid.Parse(incoming.EventId!),
            EventTypes.CtaClick,
            now,
            now,
            anonymizer.Hash(message.SessionId),
            message.Lang!,
            message.Theme!,
            DeviceClass.FromUserAgent(request.Headers.UserAgent),
            incoming.Payload!.Value);
        try
        {
            await producer.ProduceAsync(siteEvent, cancellationToken);
        }
        catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
        {
            LogBottleClickDropped(logger, ex.GetType().Name);
        }
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

    // Простая проверка формата: что-то@домен.зона без пробелов
    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s.]+$")]
    private static partial Regex Email();

    // Ник Telegram: 5–32 символа латиницы, цифр и подчёркиваний
    [GeneratedRegex(@"^@[A-Za-z0-9_]{5,32}$")]
    private static partial Regex TelegramUsername();

    [LoggerMessage(Level = LogLevel.Warning, Message = "Message delivery to Telegram failed ({ErrorType})")]
    private static partial void LogDeliveryFailed(ILogger logger, string errorType);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Event log unavailable ({ErrorType}), bottle click dropped")]
    private static partial void LogBottleClickDropped(ILogger logger, string errorType);
}

/// <summary>Body of <c>POST /api/messages</c>; session fields are optional and used only for the analytics event.</summary>
public sealed record MessageRequest(
    string? Name,
    string? ReplyTo,
    string? Text,
    string? Website,
    string? SessionId,
    string? Lang,
    string? Theme);

internal sealed record BottlePayload(string Cta);

[JsonSourceGenerationOptions(JsonSerializerDefaults.Web)]
[JsonSerializable(typeof(MessageRequest))]
[JsonSerializable(typeof(BottlePayload))]
internal sealed partial class MessagesJsonContext : JsonSerializerContext;
