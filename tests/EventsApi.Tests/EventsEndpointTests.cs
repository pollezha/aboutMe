using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Confluent.Kafka;
using Contracts.Events;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Testing;
using Xunit;

namespace EventsApi.Tests;

public sealed class EventsEndpointTests : IDisposable
{
    private const string SessionId = "sess-7f3c1a2b-secret";
    private const string UserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 TestAgent/9.9";

    private readonly EventsApiFactory _factory = new();

    [Fact]
    public async Task Valid_cta_click_is_accepted_and_produced_anonymized()
    {
        var response = await PostAsync(Event(EventTypes.CtaClick, new JsonObject { ["cta"] = "cv" }));

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Empty(await response.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken));
        var produced = Assert.Single(_factory.Producer.Produced);
        Assert.Equal(EventTypes.CtaClick, produced.Type);
        Assert.False(string.IsNullOrEmpty(produced.SessionHash));
        Assert.NotEqual(SessionId, produced.SessionHash);
        Assert.Equal(EventsApiFactory.Now, produced.ReceivedAt);
        Assert.Equal(Devices.Mobile, produced.Device);

        var json = JsonSerializer.Serialize(produced, SiteEventJsonContext.Default.SiteEvent);
        Assert.DoesNotContain(SessionId, json, StringComparison.Ordinal);
        Assert.DoesNotContain(EventsApiFactory.ClientIp.ToString(), json, StringComparison.Ordinal);
        Assert.DoesNotContain("TestAgent", json, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0", "desktop")]
    [InlineData("Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/130.0", "mobile")]
    [InlineData("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)", "mobile")]
    [InlineData("", "desktop")]
    public async Task Device_class_comes_from_user_agent(string userAgent, string expected)
    {
        var response = await PostAsync(Event(EventTypes.CtaClick, new JsonObject { ["cta"] = "cv" }), userAgent);

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Equal(expected, Assert.Single(_factory.Producer.Produced).Device);
    }

    [Fact]
    public async Task Event_without_type_is_rejected_with_field_errors()
    {
        var incoming = Event(EventTypes.CtaClick, new JsonObject { ["cta"] = "cv" });
        incoming.Remove("type");

        var response = await PostAsync(incoming);

        var problem = await AssertValidationProblemAsync(response);
        Assert.Contains("type", problem.Errors.Keys);
        Assert.Empty(_factory.Producer.Produced);
    }

    [Fact]
    public async Task Array_of_cta_clicks_is_rejected()
    {
        var batch = new JsonArray(
            Event(EventTypes.CtaClick, new JsonObject { ["cta"] = "cv" }),
            Event(EventTypes.CtaClick, new JsonObject { ["cta"] = "email" }));

        var response = await PostAsync(batch);

        var problem = await AssertValidationProblemAsync(response);
        Assert.Contains("[0].type", problem.Errors.Keys);
        Assert.Contains("[1].type", problem.Errors.Keys);
        Assert.Empty(_factory.Producer.Produced);
    }

    [Fact]
    public async Task Array_of_20_web_vitals_is_accepted()
    {
        var response = await PostAsync(WebVitals(20));

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Equal(20, _factory.Producer.Produced.Count);
        Assert.Single(_factory.Producer.Produced.Select(e => e.SessionHash).Distinct(StringComparer.Ordinal));
    }

    [Theory]
    [InlineData(21)]
    [InlineData(0)]
    public async Task Array_outside_1_to_20_events_is_rejected(int count)
    {
        var response = await PostAsync(WebVitals(count));

        await AssertValidationProblemAsync(response);
        Assert.Empty(_factory.Producer.Produced);
    }

    [Fact]
    public async Task One_invalid_event_rejects_the_whole_batch_with_indexed_paths()
    {
        var batch = WebVitals(3);
        batch[1]!["payload"]!["value"] = -1;

        var response = await PostAsync(batch);

        var problem = await AssertValidationProblemAsync(response);
        Assert.Equal(["[1].payload.value"], problem.Errors.Keys);
        Assert.Empty(_factory.Producer.Produced);
    }

    [Theory]
    [InlineData("{\"type\":")]
    [InlineData("not json")]
    [InlineData("")]
    [InlineData("42")]
    public async Task Malformed_body_is_rejected(string body)
    {
        var response = await PostRawAsync(body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Empty(_factory.Producer.Produced);
    }

    // Экранированный непарный суррогат — валидный JSON, но строку из него не получить (GetString бросает)
    [Theory]
    [InlineData("payload.stop", false)]
    [InlineData("payload.lone", false)]
    [InlineData("sessionId", false)]
    [InlineData("type", false)]
    [InlineData("lone", false)]
    [InlineData("payload.stop", true)]
    public async Task Unpaired_surrogate_is_rejected_with_400(string field, bool batch)
    {
        const string Marker = "LONE-SURROGATE";
        var incoming = Event(EventTypes.StopOpened, new JsonObject { ["stop"] = "profile" });
        var parent = field.StartsWith("payload.", StringComparison.Ordinal) ? incoming["payload"]!.AsObject() : incoming;
        var name = field.Split('.')[^1];
        if (name == "lone")
        {
            parent[Marker] = "x";
        }
        else
        {
            parent[name] = Marker;
        }

        var body = (batch ? new JsonArray(incoming) : (JsonNode)incoming).ToJsonString().Replace(Marker, "\\ud800", StringComparison.Ordinal);

        var response = await PostRawAsync(body);

        await AssertValidationProblemAsync(response);
        Assert.Empty(_factory.Producer.Produced);
    }

    [Fact]
    public async Task Field_of_wrong_json_type_is_reported_by_its_path()
    {
        var incoming = Event(EventTypes.CtaClick, new JsonObject { ["cta"] = "cv" });
        incoming["occurredAt"] = "yesterday";

        var response = await PostAsync(new JsonArray(incoming));

        var problem = await AssertValidationProblemAsync(response);
        Assert.Contains("[0].occurredAt", problem.Errors.Keys);
    }

    [Fact]
    public async Task Body_over_16_kb_is_rejected_with_413()
    {
        var incoming = Event(EventTypes.SkillOpened, new JsonObject { ["skill"] = "kafka" });
        incoming["padding"] = new string('x', 16 * 1024);

        var response = await PostAsync(incoming);

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);
        Assert.Empty(_factory.Producer.Produced);
    }

    public static TheoryData<Exception> ProducerFailures() =>
    [
        new TimeoutException("delivery timed out"),
        new ProduceException<string, string>(new Error(ErrorCode.Local_MsgTimedOut), new DeliveryResult<string, string>()),
        new KafkaException(ErrorCode.Local_AllBrokersDown),
    ];

    [Theory]
    [MemberData(nameof(ProducerFailures))]
    public async Task Unavailable_event_log_returns_503_without_details(Exception failure)
    {
        _factory.Producer.Failure = failure;

        var response = await PostAsync(Event(EventTypes.CtaClick, new JsonObject { ["cta"] = "cv" }));

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(TestContext.Current.CancellationToken);
        Assert.NotNull(problem);
        Assert.Equal("Event log unavailable", problem.Title);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        Assert.DoesNotContain(failure.Message, body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Request_logs_contain_no_session_id_ip_or_user_agent()
    {
        await PostAsync(Event(EventTypes.CtaClick, new JsonObject { ["cta"] = "cv" }));
        var invalid = Event(EventTypes.CtaClick, new JsonObject { ["cta"] = "nope" });
        await PostAsync(invalid);
        _factory.Producer.Failure = new TimeoutException("delivery timed out");
        await PostAsync(Event(EventTypes.CtaClick, new JsonObject { ["cta"] = "cv" }));

        var records = _factory.Services.GetRequiredService<FakeLogCollector>().GetSnapshot();
        Assert.NotEmpty(records);
        foreach (var record in records)
        {
            var text = string.Join(
                " | ",
                new[] { record.Message, record.Exception?.ToString() }
                    .Concat(record.StructuredState?.Select(kv => $"{kv.Key}={kv.Value}") ?? []));
            Assert.DoesNotContain(SessionId, text, StringComparison.Ordinal);
            Assert.DoesNotContain(EventsApiFactory.ClientIp.ToString(), text, StringComparison.Ordinal);
            Assert.DoesNotContain("TestAgent", text, StringComparison.Ordinal);
        }
    }

    [Fact]
    public async Task Alive_does_not_depend_on_kafka()
    {
        var response = await _factory.CreateClient().GetAsync("/alive", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    public void Dispose() => _factory.Dispose();

    private static JsonObject Event(string type, JsonObject payload) => new()
    {
        ["eventId"] = Guid.CreateVersion7(EventsApiFactory.Now).ToString(),
        ["type"] = type,
        ["occurredAt"] = EventsApiFactory.Now.AddSeconds(-1).ToString("O"),
        ["sessionId"] = SessionId,
        ["lang"] = "en",
        ["theme"] = "day",
        ["payload"] = payload,
    };

    private static JsonArray WebVitals(int count) =>
        new([.. Enumerable.Range(0, count).Select(i => (JsonNode)Event(EventTypes.WebVital, new JsonObject { ["name"] = "LCP", ["value"] = 1200 + i }))]);

    private Task<HttpResponseMessage> PostAsync(JsonNode body, string userAgent = UserAgent) =>
        PostRawAsync(body.ToJsonString(), userAgent);

    private async Task<HttpResponseMessage> PostRawAsync(string body, string userAgent = UserAgent)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/events")
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json"),
        };
        if (userAgent.Length > 0)
        {
            request.Headers.TryAddWithoutValidation("User-Agent", userAgent);
        }

        return await _factory.CreateClient().SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static async Task<ValidationProblemDetails> AssertValidationProblemAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(TestContext.Current.CancellationToken);
        Assert.NotNull(problem);
        Assert.NotEmpty(problem.Errors);
        return problem;
    }
}
