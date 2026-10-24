using System.Diagnostics;
using System.Text.RegularExpressions;
using OpenTelemetry;

namespace EventsApi.Telegram;

/// <summary>
/// Replaces the bot token in URL tags of outgoing-request spans (<c>/bot{token}/</c> → <c>/bot&lt;redacted&gt;/</c>)
/// before they reach the exporter. Must be registered before the exporter's processor.
/// </summary>
public sealed partial class TelegramUrlRedactionProcessor : BaseProcessor<Activity>
{
    private static readonly string[] UrlTags = ["url.full", "http.url", "url.path"];

    public override void OnEnd(Activity data)
    {
        ArgumentNullException.ThrowIfNull(data);
        foreach (var tag in UrlTags)
        {
            if (data.GetTagItem(tag) is string value && value.Contains("/bot", StringComparison.Ordinal))
            {
                data.SetTag(tag, BotTokenInPath().Replace(value, "/bot<redacted>/"));
            }
        }
    }

    [GeneratedRegex(@"/bot[^/]+/")]
    private static partial Regex BotTokenInPath();
}
