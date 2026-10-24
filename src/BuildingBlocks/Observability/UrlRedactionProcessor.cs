using System.Diagnostics;
using OpenTelemetry;

namespace BuildingBlocks.Observability;

/// <summary>
/// Rewrites URL tags of ended spans (<c>url.full</c>, <c>http.url</c>, <c>url.path</c>) with <paramref name="redact"/>
/// before they reach the exporter — e.g. to hide a secret in the path. Other tags are untouched.
/// Must be registered before the exporter's processor.
/// </summary>
public sealed class UrlRedactionProcessor(Func<string, string> redact) : BaseProcessor<Activity>
{
    private static readonly string[] UrlTags = ["url.full", "http.url", "url.path"];

    private readonly Func<string, string> _redact = redact ?? throw new ArgumentNullException(nameof(redact));

    public override void OnEnd(Activity data)
    {
        ArgumentNullException.ThrowIfNull(data);
        foreach (var tag in UrlTags)
        {
            if (data.GetTagItem(tag) is string value)
            {
                var redacted = _redact(value);
                if (!string.Equals(redacted, value, StringComparison.Ordinal))
                {
                    data.SetTag(tag, redacted);
                }
            }
        }
    }
}
