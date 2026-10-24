using System.Text.Json;
using System.Text.Json.Nodes;
using Contracts.Events;
using EventsApi.Application.IngestEvents;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace EventsApi.Tests.Application;

public sealed class IngestEventsHandlerTests
{
    private const string SessionId = "sess-handler-0001";
    private const string MobileAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148";

    private static readonly DateTimeOffset Now = new(2026, 10, 20, 12, 0, 0, TimeSpan.Zero);

    private readonly FakeEventPublisher _publisher = new();
    private readonly IngestEventsHandler _handler;

    public IngestEventsHandlerTests()
    {
        var clock = new ManualTimeProvider(Now);
        _handler = new IngestEventsHandler(
            new EventValidator(clock), new FixedDailySalt(), _publisher, clock, NullLogger<IngestEventsHandler>.Instance);
    }

    [Fact]
    public async Task Valid_event_is_anonymized_and_published()
    {
        var result = await HandleAsync(Event(EventTypes.CtaClick, new JsonObject { ["cta"] = "cv" }), MobileAgent);

        Assert.IsType<IngestEventsResult.Accepted>(result);
        var published = Assert.Single(_publisher.Published);
        Assert.Equal(EventTypes.CtaClick, published.Type);
        Assert.Equal(Now, published.ReceivedAt);
        Assert.Equal(Devices.Mobile, published.Device);
        Assert.NotEqual(SessionId, published.SessionHash);
        Assert.DoesNotContain(SessionId, published.SessionHash, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Invalid_batch_fails_with_errors_by_path_and_publishes_nothing()
    {
        var batch = new JsonArray(
            Event(EventTypes.WebVital, new JsonObject { ["name"] = "LCP", ["value"] = 1200 }),
            Event(EventTypes.CtaClick, new JsonObject { ["cta"] = "cv" }),
            Event(EventTypes.WebVital, new JsonObject { ["name"] = "LCP", ["value"] = -1 }));

        var result = await HandleAsync(batch);

        var failed = Assert.IsType<IngestEventsResult.ValidationFailed>(result);
        Assert.Equal(["[1].type", "[2].payload.value"], failed.Errors.Keys.Order(StringComparer.Ordinal));
        Assert.Empty(_publisher.Published);
    }

    [Fact]
    public async Task Batch_over_20_events_fails_at_the_root()
    {
        var batch = new JsonArray([.. Enumerable.Range(0, 21)
            .Select(_ => (JsonNode)Event(EventTypes.WebVital, new JsonObject { ["name"] = "LCP", ["value"] = 1200 }))]);

        var result = await HandleAsync(batch);

        var failed = Assert.IsType<IngestEventsResult.ValidationFailed>(result);
        Assert.Equal(["$"], failed.Errors.Keys);
        Assert.Empty(_publisher.Published);
    }

    [Fact]
    public async Task Publisher_failure_gives_publish_failed()
    {
        _publisher.Failure = new TimeoutException("delivery timed out");

        var result = await HandleAsync(Event(EventTypes.CtaClick, new JsonObject { ["cta"] = "cv" }));

        Assert.IsType<IngestEventsResult.PublishFailed>(result);
    }

    private async Task<IngestEventsResult> HandleAsync(JsonNode body, string? userAgent = null)
    {
        using var document = JsonDocument.Parse(body.ToJsonString());
        return await _handler.HandleAsync(
            new IngestEventsCommand(document.RootElement, userAgent), TestContext.Current.CancellationToken);
    }

    private static JsonObject Event(string type, JsonObject payload) => new()
    {
        ["eventId"] = Guid.CreateVersion7(Now).ToString(),
        ["type"] = type,
        ["occurredAt"] = Now.AddSeconds(-1).ToString("O"),
        ["sessionId"] = SessionId,
        ["lang"] = "en",
        ["theme"] = "day",
        ["payload"] = payload,
    };
}
