using System.Text.Json;
using Contracts.Events;
using Projector.Projection;
using Xunit;

namespace Projector.Tests;

public sealed class AggregatorTests
{
    private static readonly DateTimeOffset Noon = new(2026, 10, 20, 12, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Day = new(2026, 10, 20);

    [Fact]
    public void Three_stop_opens_of_one_day_fold_into_one_delta()
    {
        var events = Enumerable.Range(0, 3)
            .Select(i => Event(EventTypes.StopOpened, """{"stop":"profile"}""", Noon.AddMinutes(i)));

        var deltas = Aggregator.Aggregate(events);

        Assert.Equal([new StopOpenDelta(Day, "profile", 3)], deltas);
    }

    [Fact]
    public void Events_of_different_days_and_keys_stay_separate()
    {
        var events = new[]
        {
            Event(EventTypes.StopOpened, """{"stop":"profile"}""", Noon),
            Event(EventTypes.StopOpened, """{"stop":"profile"}""", Noon.AddDays(1)),
            Event(EventTypes.StopOpened, """{"stop":"skills"}""", Noon),
        };

        var deltas = Aggregator.Aggregate(events);

        Assert.Equal(3, deltas.Count);
        Assert.Contains(new StopOpenDelta(Day.AddDays(1), "profile", 1), deltas);
        Assert.Contains(new StopOpenDelta(Day, "skills", 1), deltas);
    }

    [Fact]
    public void Day_is_the_utc_date_of_occurred_at()
    {
        var lateEveningInBrazil = new DateTimeOffset(2026, 10, 20, 23, 30, 0, TimeSpan.FromHours(-3));

        var delta = Aggregator.ToDelta(Event(EventTypes.StopOpened, """{"stop":"profile"}""", lateEveningInBrazil));

        Assert.Equal(new StopOpenDelta(new DateOnly(2026, 10, 21), "profile", 1), delta);
    }

    [Fact]
    public void Visit_counts_by_source_and_device()
    {
        var delta = Aggregator.ToDelta(Event(EventTypes.Visit, """{"source":"hh"}""", Noon, Devices.Mobile));

        Assert.Equal(new DailyVisitDelta(Day, "hh", Devices.Mobile, 1), delta);
    }

    [Fact]
    public void Cta_click_without_source_is_counted_as_unknown()
    {
        var delta = Aggregator.ToDelta(Event(EventTypes.CtaClick, """{"cta":"contact"}""", Noon));

        Assert.Equal(new CtaClickDelta(Day, "contact", "unknown", 1), delta);
    }

    [Fact]
    public void Cta_click_with_source_keeps_it()
    {
        var delta = Aggregator.ToDelta(Event(EventTypes.CtaClick, """{"cta":"cv","source":"linkedin"}""", Noon));

        Assert.Equal(new CtaClickDelta(Day, "cv", "linkedin", 1), delta);
    }

    [Fact]
    public void Web_vital_goes_to_its_bucket()
    {
        var delta = Aggregator.ToDelta(Event(EventTypes.WebVital, """{"name":"LCP","value":1200.5}""", Noon));

        Assert.Equal(new WebVitalDelta(Day, "LCP", 2, 1), delta);
    }

    [Theory]
    [InlineData("""{"skill":"kafka"}""", EventTypes.SkillOpened)]
    [InlineData("""{"x":1}""", "future_type")]
    [InlineData("""{}""", EventTypes.StopOpened)]
    [InlineData("""{"name":"LCP"}""", EventTypes.WebVital)]
    [InlineData("""{"name":"XYZ","value":1}""", EventTypes.WebVital)]
    public void Events_without_an_aggregate_give_no_delta(string payload, string type)
    {
        Assert.Null(Aggregator.ToDelta(Event(type, payload, Noon)));
    }

    [Theory]
    [InlineData(WebVitalNames.Lcp, 0, 0)]
    [InlineData(WebVitalNames.Lcp, 500, 0)]
    [InlineData(WebVitalNames.Lcp, 500.1, 1)]
    [InlineData(WebVitalNames.Lcp, 6000, 7)]
    [InlineData(WebVitalNames.Lcp, 6000.1, 8)]
    [InlineData(WebVitalNames.Fcp, 2500, 4)]
    [InlineData(WebVitalNames.Ttfb, 120_000, 8)]
    [InlineData(WebVitalNames.Inp, 100, 0)]
    [InlineData(WebVitalNames.Inp, 1000, 4)]
    [InlineData(WebVitalNames.Inp, 1001, 5)]
    [InlineData(WebVitalNames.Cls, 0.05, 0)]
    [InlineData(WebVitalNames.Cls, 0.06, 1)]
    [InlineData(WebVitalNames.Cls, 0.5, 4)]
    [InlineData(WebVitalNames.Cls, 3, 5)]
    public void Bucket_is_the_index_of_the_inclusive_upper_bound(string name, double value, int bucket)
    {
        Assert.Equal(bucket, VitalBuckets.Bucket(name, value));
    }

    [Fact]
    public void Unknown_vital_has_no_bucket()
    {
        Assert.Null(VitalBuckets.Bucket("FID", 10));
    }

    private static SiteEvent Event(string type, string payload, DateTimeOffset occurredAt, string device = Devices.Desktop)
    {
        using var doc = JsonDocument.Parse(payload);
        return new SiteEvent(
            Guid.CreateVersion7(), type, occurredAt, occurredAt, "hash", Langs.En, Themes.Day, device, doc.RootElement.Clone());
    }
}
