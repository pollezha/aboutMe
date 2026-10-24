namespace EventsApi.Infrastructure.External.Telegram;

/// <summary>Owner's Telegram bot (design §5.3 «Записки»): token and chat id come from the environment.</summary>
public sealed class TelegramOptions
{
    public const string Section = "Telegram";

    public string? BotToken { get; set; }

    public string? ChatId { get; set; }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(BotToken) && !string.IsNullOrWhiteSpace(ChatId);
}
