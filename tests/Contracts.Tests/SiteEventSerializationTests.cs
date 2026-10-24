using System.Text.Json;
using Contracts.Content;
using Contracts.Events;
using Xunit;

namespace Contracts.Tests;

public sealed class SiteEventSerializationTests
{
    // Пример из design §5.4: camelCase, порядок полей как в дизайне, время в UTC с суффиксом Z.
    private const string DesignExample =
        """{"eventId":"0192f5c4-6f1e-7c3a-9b2d-4e5f6a7b8c9d","type":"cta_click","occurredAt":"2026-10-20T12:00:00Z","receivedAt":"2026-10-20T12:00:01Z","sessionHash":"q1w2e3r4t5y6u7i8o9p0aA","lang":"en","theme":"day","device":"desktop","payload":{"cta":"telegram"}}""";

    [Fact]
    public void Round_trip_reproduces_design_example_byte_for_byte()
    {
        var siteEvent = JsonSerializer.Deserialize(DesignExample, SiteEventJsonContext.Default.SiteEvent);

        var json = JsonSerializer.Serialize(siteEvent, SiteEventJsonContext.Default.SiteEvent);

        Assert.Equal(DesignExample, json);
    }

    [Fact]
    public void Constructed_event_serializes_to_design_example()
    {
        using var payload = JsonDocument.Parse("""{"cta":"telegram"}""");
        var siteEvent = new SiteEvent(
            Guid.Parse("0192f5c4-6f1e-7c3a-9b2d-4e5f6a7b8c9d"),
            EventTypes.CtaClick,
            new DateTimeOffset(2026, 10, 20, 15, 0, 0, TimeSpan.FromHours(3)),
            new DateTimeOffset(2026, 10, 20, 12, 0, 1, TimeSpan.Zero),
            "q1w2e3r4t5y6u7i8o9p0aA",
            Langs.En,
            Themes.Day,
            Devices.Desktop,
            payload.RootElement);

        var json = JsonSerializer.Serialize(siteEvent, SiteEventJsonContext.Default.SiteEvent);

        Assert.Equal(DesignExample, json);
    }

    [Fact]
    public void Fractional_seconds_survive_round_trip()
    {
        var json = DesignExample.Replace("12:00:01Z", "12:00:01.123Z", StringComparison.Ordinal);

        var siteEvent = JsonSerializer.Deserialize(json, SiteEventJsonContext.Default.SiteEvent)!;

        Assert.Equal(123, siteEvent.ReceivedAt.Millisecond);
        Assert.Equal(json, JsonSerializer.Serialize(siteEvent, SiteEventJsonContext.Default.SiteEvent));
    }

    [Fact]
    public void Content_bundle_info_serializes_in_camel_case()
    {
        var info = new ContentBundleInfo(Langs.Ru, "2026-10-20T12:00:00Z", "abc123", 1);

        var json = JsonSerializer.Serialize(info, ContentJsonContext.Default.ContentBundleInfo);

        Assert.Equal(
            """{"lang":"ru","contentVersion":"2026-10-20T12:00:00Z","versionHash":"abc123","schemaVersion":1}""",
            json);
    }
}
