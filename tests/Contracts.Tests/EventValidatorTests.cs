using System.Text.Json;
using System.Text.Json.Nodes;
using Contracts.Events;
using Xunit;

namespace Contracts.Tests;

public sealed class EventValidatorTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 20, 12, 0, 1, TimeSpan.Zero);

    private const string UuidV7 = "0192f5c4-6f1e-7c3a-9b2d-4e5f6a7b8c9d";

    public static TheoryData<string, string> ValidEvents => new()
    {
        { EventTypes.Visit, """{"source":"linkedin"}""" },
        { EventTypes.StopOpened, """{"stop":"experience"}""" },
        { EventTypes.SkillOpened, """{"skill":"Kafka"}""" },
        { EventTypes.CtaClick, """{"cta":"bottle"}""" },
        { EventTypes.WebVital, """{"name":"LCP","value":1234.5}""" },
    };

    [Theory]
    [MemberData(nameof(ValidEvents))]
    public void Valid_event_of_each_type_has_no_errors(string type, string payload)
    {
        var errors = Validate(Event(type, payload));

        Assert.Empty(errors);
    }

    // Каждый случай нарушает ровно одно правило; ожидается ровно одна ошибка с путём поля.
    public static TheoryData<string, string, string> InvalidEvents => new()
    {
        { "eventId missing", With("eventId", null), "eventId" },
        { "eventId not a uuid", With("eventId", "not-a-uuid"), "eventId" },
        { "eventId is uuid v4", With("eventId", "0192f5c4-6f1e-4c3a-9b2d-4e5f6a7b8c9d"), "eventId" },
        { "type missing", With("type", null), "type" },
        { "type unknown", With("type", "page_view"), "type" },
        { "occurredAt missing", With("occurredAt", null), "occurredAt" },
        { "occurredAt older than a day", With("occurredAt", "2026-10-19T12:00:00Z"), "occurredAt" },
        { "occurredAt more than a day ahead", With("occurredAt", "2026-10-21T12:00:02Z"), "occurredAt" },
        { "sessionId missing", With("sessionId", null), "sessionId" },
        { "sessionId too long", With("sessionId", new string('s', 65)), "sessionId" },
        { "lang unknown", With("lang", "de"), "lang" },
        { "theme unknown", With("theme", "dusk"), "theme" },
        { "payload missing", With("payload", null), "payload" },
        { "payload not an object", With("payload", new JsonArray()), "payload" },
        { "payload extra field", Event(EventTypes.Visit, """{"source":"hh","utm":"x"}"""), "payload.utm" },
        { "visit source missing", Event(EventTypes.Visit, "{}"), "payload.source" },
        { "visit source unknown", Event(EventTypes.Visit, """{"source":"facebook"}"""), "payload.source" },
        { "stop_opened stop too long", Event(EventTypes.StopOpened, $$"""{"stop":"{{new string('a', 33)}}"}"""), "payload.stop" },
        { "stop_opened stop empty", Event(EventTypes.StopOpened, """{"stop":""}"""), "payload.stop" },
        { "stop_opened stop not a string", Event(EventTypes.StopOpened, """{"stop":7}"""), "payload.stop" },
        { "skill_opened skill too long", Event(EventTypes.SkillOpened, $$"""{"skill":"{{new string('a', 65)}}"}"""), "payload.skill" },
        { "cta_click cta unknown", Event(EventTypes.CtaClick, """{"cta":"phone"}"""), "payload.cta" },
        { "web_vital name unknown", Event(EventTypes.WebVital, """{"name":"FID","value":10}"""), "payload.name" },
        { "web_vital value negative", Event(EventTypes.WebVital, """{"name":"CLS","value":-0.1}"""), "payload.value" },
        { "web_vital value not a number", Event(EventTypes.WebVital, """{"name":"INP","value":"10"}"""), "payload.value" },
    };

    [Theory]
    [MemberData(nameof(InvalidEvents))]
    public void Invalid_event_reports_error_with_field_path(string rule, string json, string expectedPath)
    {
        var errors = Validate(json);

        var error = Assert.Single(errors);
        Assert.True(error.Path == expectedPath, $"{rule}: expected path '{expectedPath}', got '{error.Path}'");
        Assert.False(string.IsNullOrWhiteSpace(error.Message));
    }

    [Theory]
    [InlineData("2026-10-19T12:00:01Z")]
    [InlineData("2026-10-21T12:00:01Z")]
    public void OccurredAt_exactly_one_day_from_now_is_allowed(string occurredAt)
    {
        var errors = Validate(With("occurredAt", occurredAt));

        Assert.Empty(errors);
    }

    [Fact]
    public void All_errors_are_reported_at_once()
    {
        var json = JsonNode.Parse(Event(EventTypes.CtaClick, """{"cta":"phone"}"""))!;
        json["lang"] = "de";
        json["eventId"] = "nope";

        var errors = Validate(json.ToJsonString());

        Assert.Equal(["eventId", "lang", "payload.cta"], errors.Select(e => e.Path).Order(StringComparer.Ordinal));
    }

    [Fact]
    public void Payload_is_not_checked_when_type_is_unknown()
    {
        var errors = Validate(Event("page_view", """{"anything":1}"""));

        Assert.Equal("type", Assert.Single(errors).Path);
    }

    private static List<ValidationError> Validate(string json)
    {
        var incoming = JsonSerializer.Deserialize(json, SiteEventJsonContext.Default.IncomingEvent)!;
        return [.. new EventValidator(new FixedTimeProvider(Now)).Validate(incoming)];
    }

    private static string Event(string type, string payload) =>
        $$"""
        {"eventId":"{{UuidV7}}","type":"{{type}}","occurredAt":"2026-10-20T12:00:00Z","sessionId":"5f0c2a9e-browser-session","lang":"ru","theme":"night","payload":{{payload}}}
        """;

    private static string With(string field, JsonNode? value)
    {
        var json = JsonNode.Parse(Event(EventTypes.Visit, """{"source":"direct"}"""))!.AsObject();
        if (value is null)
        {
            json.Remove(field);
        }
        else
        {
            json[field] = value;
        }

        return json.ToJsonString();
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
