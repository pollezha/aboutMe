using System.Net.Http.Json;
using EventsApi.Application.Abstractions;
using EventsApi.Domain;
using Microsoft.Extensions.Options;

namespace EventsApi.Infrastructure.External.Telegram;

/// <summary>
/// Typed client of the Telegram Bot API that sends a message in a bottle to the owner's chat as plain text. The
/// token is part of the request path, so the client has no HTTP loggers and its spans are redacted by
/// <see cref="TelegramBotToken.Redact"/>.
/// </summary>
public sealed class TelegramContactMessageDelivery(HttpClient httpClient, IOptions<TelegramOptions> options)
    : IContactMessageDelivery
{
    /// <exception cref="InvalidOperationException">The bot is not configured.</exception>
    /// <exception cref="HttpRequestException">Telegram answered with a non-success status after retries.</exception>
    public async Task DeliverAsync(ContactMessage message, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(message);

        var settings = options.Value;
        if (!settings.IsConfigured || httpClient.BaseAddress is null)
        {
            throw new InvalidOperationException("Telegram bot is not configured.");
        }

        using var response = await httpClient.PostAsJsonAsync(
            "sendMessage",
            new TelegramSendMessageRequest(settings.ChatId!, $"Bottle from {message.Name} ({message.ReplyTo}):\n{message.Text}"),
            TelegramJsonContext.Default.TelegramSendMessageRequest,
            cancellationToken);
        response.EnsureSuccessStatusCode();
    }
}
