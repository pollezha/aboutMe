using System.Text.Json.Serialization;

namespace EventsApi.Infrastructure.External.Telegram;

/// <summary>Body of Bot API <c>sendMessage</c>; no <c>parse_mode</c>, so user text is never interpreted as markup.</summary>
public sealed record TelegramSendMessageRequest(
    [property: JsonPropertyName("chat_id")] string ChatId,
    [property: JsonPropertyName("text")] string Text);
