using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace EventsApi.Telegram;

/// <summary>Owner's Telegram bot (design §5.3 «Записки»): token and chat id come from the environment.</summary>
public sealed class TelegramOptions
{
    public const string Section = "Telegram";

    public string? BotToken { get; set; }

    public string? ChatId { get; set; }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(BotToken) && !string.IsNullOrWhiteSpace(ChatId);
}

/// <summary>
/// Typed client of the Telegram Bot API. The token is part of the request path
/// (<c>https://api.telegram.org/bot{token}/</c>), so the client has no HTTP loggers and its spans are redacted
/// by <see cref="TelegramUrlRedactionProcessor"/>.
/// </summary>
public sealed class TelegramClient(HttpClient httpClient, IOptions<TelegramOptions> options)
{
    public static Uri BaseAddressFor(string botToken) => new($"https://api.telegram.org/bot{botToken}/");

    /// <summary>Sends plain text (no <c>parse_mode</c>: user text is never interpreted as markup).</summary>
    /// <exception cref="InvalidOperationException">The bot is not configured.</exception>
    /// <exception cref="HttpRequestException">Telegram answered with a non-success status after retries.</exception>
    public async Task SendMessageAsync(string text, CancellationToken cancellationToken)
    {
        var settings = options.Value;
        if (!settings.IsConfigured || httpClient.BaseAddress is null)
        {
            throw new InvalidOperationException("Telegram bot is not configured.");
        }

        using var response = await httpClient.PostAsJsonAsync(
            "sendMessage",
            new SendMessageRequest(settings.ChatId!, text),
            TelegramJsonContext.Default.SendMessageRequest,
            cancellationToken);
        response.EnsureSuccessStatusCode();
    }
}

public sealed record SendMessageRequest(
    [property: JsonPropertyName("chat_id")] string ChatId,
    [property: JsonPropertyName("text")] string Text);

[JsonSerializable(typeof(SendMessageRequest))]
internal sealed partial class TelegramJsonContext : JsonSerializerContext;
