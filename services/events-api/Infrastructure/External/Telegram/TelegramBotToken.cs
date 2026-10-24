using System.Text.RegularExpressions;

namespace EventsApi.Infrastructure.External.Telegram;

/// <summary>The bot token is part of the Bot API path (<c>/bot{token}/</c>) and must not reach spans or logs.</summary>
public static partial class TelegramBotToken
{
    public static Uri BaseAddressFor(string botToken) => new($"https://api.telegram.org/bot{botToken}/");

    /// <summary><c>…/bot{token}/…</c> → <c>…/bot&lt;redacted&gt;/…</c>; other URLs are returned as is.</summary>
    public static string Redact(string url)
    {
        ArgumentNullException.ThrowIfNull(url);
        return url.Contains("/bot", StringComparison.Ordinal) ? TokenInPath().Replace(url, "/bot<redacted>/") : url;
    }

    [GeneratedRegex(@"/bot[^/]+/")]
    private static partial Regex TokenInPath();
}
