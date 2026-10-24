using System.Diagnostics;
using System.Text.Json;
using Contracts.Events;
using EventsApi.Application.Abstractions;
using EventsApi.Domain;
using Microsoft.Extensions.Logging;

namespace EventsApi.Application.SendContactMessage;

/// <summary>
/// Message in a bottle (FR17, design §5.3): forwarded to the owner and stored nowhere. Filled honeypot → ignored;
/// invalid → errors by field; delivered → optionally a <c>cta_click{cta: bottle}</c> event (no message content)
/// when the session fields are valid. Name, reply address and text never reach logs or spans (only lengths).
/// </summary>
public sealed partial class SendContactMessageHandler(
    IContactMessageDelivery delivery,
    EventValidator validator,
    IDailySalt dailySalt,
    IEventPublisher publisher,
    TimeProvider timeProvider,
    ILogger<SendContactMessageHandler> logger)
{
    public async Task<SendContactMessageResult> HandleAsync(SendContactMessageCommand command, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        if (!string.IsNullOrEmpty(command.Website))
        {
            return new SendContactMessageResult.Ignored();
        }

        var message = ContactMessage.From(command.Name, command.ReplyTo, command.Text);

        var activity = Activity.Current;
        activity?.SetTag("message.name_length", message.Name.Length);
        activity?.SetTag("message.reply_to_length", message.ReplyTo.Length);
        activity?.SetTag("message.text_length", message.Text.Length);

        var errors = message.Validate();
        if (errors.Count > 0)
        {
            return new SendContactMessageResult.ValidationFailed(errors);
        }

        try
        {
            await delivery.DeliverAsync(message, cancellationToken);
        }
        catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
        {
            LogDeliveryFailed(ex.GetType().Name);
            return new SendContactMessageResult.DeliveryFailed();
        }

        await PublishBottleClickAsync(command, cancellationToken);
        return new SendContactMessageResult.Delivered();
    }

    /// <summary>
    /// Analytics only: the event is skipped when the session fields are missing or invalid, and a broken event log
    /// does not affect the already delivered message.
    /// </summary>
    private async Task PublishBottleClickAsync(SendContactMessageCommand command, CancellationToken cancellationToken)
    {
        if (command.SessionId is null)
        {
            return;
        }

        var now = timeProvider.GetUtcNow();
        using var payload = JsonSerializer.SerializeToDocument(
            new BottleClickPayload(CtaTargets.Bottle), BottleClickPayloadJsonContext.Default.BottleClickPayload);
        var incoming = new IncomingEvent(
            Guid.CreateVersion7(now).ToString(),
            EventTypes.CtaClick,
            now,
            command.SessionId,
            command.Lang,
            command.Theme,
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
            Anonymizer.Hash(command.SessionId, dailySalt.GetCurrent().Span),
            command.Lang!,
            command.Theme!,
            DeviceClass.FromUserAgent(command.UserAgent),
            incoming.Payload!.Value);
        try
        {
            await publisher.PublishAsync(siteEvent, cancellationToken);
        }
        catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
        {
            LogBottleClickDropped(ex.GetType().Name);
        }
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Message delivery failed ({ErrorType})")]
    private partial void LogDeliveryFailed(string errorType);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Event log unavailable ({ErrorType}), bottle click dropped")]
    private partial void LogBottleClickDropped(string errorType);
}
