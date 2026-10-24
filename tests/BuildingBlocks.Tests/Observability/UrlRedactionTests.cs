using System.Diagnostics;
using System.Text.RegularExpressions;
using BuildingBlocks.Observability;
using Microsoft.Extensions.DependencyInjection;
using OpenTelemetry;
using OpenTelemetry.Trace;
using Xunit;

namespace BuildingBlocks.Tests.Observability;

public sealed class UrlRedactionTests
{
    private static string RedactBotToken(string url) =>
        Regex.Replace(url, "/bot[^/]+/", "/bot<redacted>/", RegexOptions.None, TimeSpan.FromSeconds(1));

    [Fact]
    public void Url_tags_are_redacted_and_other_tags_are_untouched()
    {
        using var activity = new Activity("send");
        activity.SetTag("url.full", "https://api.telegram.org/bot123:abc/sendMessage");
        activity.SetTag("http.url", "https://api.telegram.org/bot123:abc/sendMessage");
        activity.SetTag("url.path", "/bot123:abc/sendMessage");
        activity.SetTag("server.address", "/bot123:abc/");
        activity.SetTag("http.response.status_code", 200);

        using var processor = new UrlRedactionProcessor(RedactBotToken);
        processor.OnEnd(activity);

        Assert.Equal("https://api.telegram.org/bot<redacted>/sendMessage", activity.GetTagItem("url.full"));
        Assert.Equal("https://api.telegram.org/bot<redacted>/sendMessage", activity.GetTagItem("http.url"));
        Assert.Equal("/bot<redacted>/sendMessage", activity.GetTagItem("url.path"));
        Assert.Equal("/bot123:abc/", activity.GetTagItem("server.address"));
        Assert.Equal(200, activity.GetTagItem("http.response.status_code"));
    }

    [Fact]
    public void AddUrlRedaction_redacts_before_later_registered_processors()
    {
        const string source = "BuildingBlocks.Tests.UrlRedaction";
        var exported = new List<object?>();
        var services = new ServiceCollection();
        services.AddOpenTelemetry().WithTracing(tracing => tracing.AddSource(source));
        services.AddUrlRedaction(RedactBotToken);
        services.ConfigureOpenTelemetryTracerProvider(tracing =>
            tracing.AddProcessor(new CapturingProcessor(a => exported.Add(a.GetTagItem("url.full")))));

        using (var provider = services.BuildServiceProvider())
        {
            _ = provider.GetRequiredService<TracerProvider>();
            using var activitySource = new ActivitySource(source);
            using (var activity = activitySource.StartActivity("send"))
            {
                Assert.NotNull(activity);
                activity.SetTag("url.full", "https://api.telegram.org/bot123:abc/getMe");
            }
        }

        Assert.Equal(["https://api.telegram.org/bot<redacted>/getMe"], exported);
    }

    private sealed class CapturingProcessor(Action<Activity> onEnd) : BaseProcessor<Activity>
    {
        public override void OnEnd(Activity data) => onEnd(data);
    }
}
