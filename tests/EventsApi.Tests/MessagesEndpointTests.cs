using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Contracts.Events;
using EventsApi.Telegram;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Testing;
using OpenTelemetry;
using OpenTelemetry.Trace;
using Xunit;

namespace EventsApi.Tests;

public sealed class MessagesEndpointTests : IDisposable
{
    private const string BotToken = "123456:SECRET-bot-token";
    private const string ChatId = "987654321";
    private const string Name = "Alice Recruiter";
    private const string ReplyTo = "alice@example.org";
    private const string Text = "Hi Yakov! We have a .NET role <b>for you</b> & more_text*";
    private const string SessionId = "sess-bottle-0001";

    private readonly EventsApiFactory _baseFactory = new();
    private readonly WebApplicationFactory<Program> _factory;
    private readonly RecordingHandler _telegram = new();
    private readonly ConcurrentQueue<Activity> _activities = new();

    public MessagesEndpointTests()
    {
        _factory = _baseFactory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Telegram:BotToken", BotToken);
            builder.UseSetting("Telegram:ChatId", ChatId);
            builder.ConfigureTestServices(services =>
            {
                services.AddHttpClient<TelegramClient>().ConfigurePrimaryHttpMessageHandler(() => _telegram);
                services.ConfigureOpenTelemetryTracerProvider(tracing => tracing.AddProcessor(new CapturingProcessor(_activities)));
            });
        });
    }

    [Fact]
    public async Task Valid_message_is_sent_to_telegram_and_accepted()
    {
        var response = await PostAsync(Message());

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Empty(await response.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken));
        var call = Assert.Single(_telegram.Requests);
        Assert.Equal(HttpMethod.Post, call.Method);
        Assert.Equal($"https://api.telegram.org/bot{BotToken}/sendMessage", call.Uri);
        using var body = JsonDocument.Parse(call.Body);
        Assert.Equal(ChatId, body.RootElement.GetProperty("chat_id").GetString());
        Assert.Equal($"Bottle from {Name} ({ReplyTo}):\n{Text}", body.RootElement.GetProperty("text").GetString());
        Assert.False(body.RootElement.TryGetProperty("parse_mode", out _));
    }

    [Fact]
    public async Task Telegram_username_is_a_valid_reply_address()
    {
        var response = await PostAsync(Message(replyTo: "@yakov_dev"));

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Single(_telegram.Requests);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public async Task Empty_text_is_rejected_with_field_error(string? text)
    {
        var message = Message();
        message["text"] = text;

        var response = await PostAsync(message);

        var problem = await AssertValidationProblemAsync(response);
        Assert.Contains("text", problem.Errors.Keys);
        Assert.Empty(_telegram.Requests);
    }

    [Theory]
    [InlineData("alice")]
    [InlineData("alice@")]
    [InlineData("alice@example")]
    [InlineData("@a b")]
    [InlineData("")]
    public async Task Malformed_reply_address_is_rejected(string replyTo)
    {
        var response = await PostAsync(Message(replyTo: replyTo));

        var problem = await AssertValidationProblemAsync(response);
        Assert.Contains("replyTo", problem.Errors.Keys);
        Assert.Empty(_telegram.Requests);
    }

    [Fact]
    public async Task Too_long_fields_are_rejected_by_field()
    {
        var message = Message();
        message["name"] = new string('n', 81);
        message["text"] = new string('t', 2001);

        var response = await PostAsync(message);

        var problem = await AssertValidationProblemAsync(response);
        Assert.Contains("name", problem.Errors.Keys);
        Assert.Contains("text", problem.Errors.Keys);
        Assert.Empty(_telegram.Requests);
    }

    [Fact]
    public async Task Body_over_4_kb_is_rejected_with_413()
    {
        var message = Message();
        message["padding"] = new string('p', 4 * 1024);

        var response = await PostAsync(message);

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);
        Assert.Empty(_telegram.Requests);
    }

    [Fact]
    public async Task Filled_honeypot_is_silently_dropped()
    {
        var message = Message(sessionId: SessionId);
        message["website"] = "http://spam.example";

        var response = await PostAsync(message);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Empty(_telegram.Requests);
        Assert.Empty(_baseFactory.Producer.Produced);
    }

    [Fact]
    public async Task Telegram_failing_after_retries_gives_503()
    {
        _telegram.Status = HttpStatusCode.InternalServerError;

        var response = await PostAsync(Message(sessionId: SessionId));

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(TestContext.Current.CancellationToken);
        Assert.Equal("Message delivery unavailable", problem?.Title);
        Assert.Null(problem?.Detail);
        Assert.Equal(3, _telegram.Requests.Count);
        Assert.Empty(_baseFactory.Producer.Produced);
    }

    [Fact]
    public async Task Message_with_session_produces_bottle_click_without_message_content()
    {
        var response = await PostAsync(Message(sessionId: SessionId));

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        var produced = Assert.Single(_baseFactory.Producer.Produced);
        Assert.Equal(EventTypes.CtaClick, produced.Type);
        Assert.Equal(CtaTargets.Bottle, produced.Payload.GetProperty("cta").GetString());
        Assert.Equal("night", produced.Theme);
        AssertNoMessageContent(JsonSerializer.Serialize(produced, SiteEventJsonContext.Default.SiteEvent));
    }

    [Fact]
    public async Task Message_without_session_produces_no_event()
    {
        var response = await PostAsync(Message());

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Empty(_baseFactory.Producer.Produced);
    }

    [Fact]
    public async Task Producer_failure_does_not_break_delivery()
    {
        _baseFactory.Producer.Failure = new TimeoutException("delivery timed out");

        var response = await PostAsync(Message(sessionId: SessionId));

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Single(_telegram.Requests);
    }

    [Fact]
    public async Task Message_content_and_token_are_not_in_logs_or_spans()
    {
        await PostAsync(Message(sessionId: SessionId));
        _baseFactory.Producer.Failure = new TimeoutException("delivery timed out");
        await PostAsync(Message(sessionId: SessionId));
        _telegram.Status = HttpStatusCode.InternalServerError;
        await PostAsync(Message());

        var records = _factory.Services.GetRequiredService<FakeLogCollector>().GetSnapshot();
        Assert.NotEmpty(records);
        foreach (var record in records)
        {
            AssertNoMessageContent(string.Join(
                " | ",
                new[] { record.Message, record.Exception?.ToString() }
                    .Concat(record.StructuredState?.Select(kv => $"{kv.Key}={kv.Value}") ?? [])));
        }

        Assert.NotEmpty(_activities);
        foreach (var activity in _activities)
        {
            AssertNoMessageContent(string.Join(
                " | ",
                new[] { activity.DisplayName, activity.OperationName }
                    .Concat(activity.TagObjects.Select(t => $"{t.Key}={t.Value}"))
                    .Concat(activity.Events.SelectMany(e => e.Tags.Select(t => $"{t.Key}={t.Value}")))));
        }

        Assert.Contains(_activities, a => Equals(a.GetTagItem("message.text_length"), Text.Length));
        Assert.Contains(_activities, a => Equals(a.GetTagItem("message.name_length"), Name.Length));
    }

    [Theory]
    [InlineData("url.full")]
    [InlineData("http.url")]
    public void Bot_token_is_redacted_in_outgoing_request_spans(string tag)
    {
        using var activity = new Activity("POST");
        activity.SetTag(tag, $"https://api.telegram.org/bot{BotToken}/sendMessage");
        using var processor = new TelegramUrlRedactionProcessor();

        processor.OnEnd(activity);

        Assert.Equal("https://api.telegram.org/bot<redacted>/sendMessage", activity.GetTagItem(tag));
    }

    [Fact]
    public void Token_redaction_is_wired_into_app_tracing()
    {
        // Фейковый HttpMessageHandler заменяет SocketsHttpHandler, а с ним и клиентский спан System.Net.Http,
        // поэтому спан с токеном здесь создаётся вручную и проходит через провайдер трейсинга приложения.
        _ = _factory.Services;
        using var source = new ActivitySource("EventsApi");
        using (var activity = source.StartActivity("POST"))
        {
            Assert.NotNull(activity);
            activity.SetTag("url.full", $"https://api.telegram.org/bot{BotToken}/sendMessage");
        }

        var captured = Assert.Single(_activities, a => a.Source.Name == "EventsApi" && a.DisplayName == "POST");
        Assert.Equal("https://api.telegram.org/bot<redacted>/sendMessage", captured.GetTagItem("url.full"));
    }

    public void Dispose()
    {
        _factory.Dispose();
        _baseFactory.Dispose();
        _telegram.Dispose();
    }

    private static void AssertNoMessageContent(string text)
    {
        Assert.DoesNotContain(Name, text, StringComparison.Ordinal);
        Assert.DoesNotContain(ReplyTo, text, StringComparison.Ordinal);
        Assert.DoesNotContain(Text, text, StringComparison.Ordinal);
        Assert.DoesNotContain("SECRET-bot-token", text, StringComparison.Ordinal);
        Assert.DoesNotContain(SessionId, text, StringComparison.Ordinal);
    }

    private static JsonObject Message(string replyTo = ReplyTo, string? sessionId = null)
    {
        var message = new JsonObject
        {
            ["name"] = Name,
            ["replyTo"] = replyTo,
            ["text"] = Text,
            ["website"] = "",
        };
        if (sessionId is not null)
        {
            message["sessionId"] = sessionId;
            message["lang"] = "en";
            message["theme"] = "night";
        }

        return message;
    }

    private async Task<HttpResponseMessage> PostAsync(JsonNode body)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/messages")
        {
            Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json"),
        };
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

    private sealed record RecordedRequest(HttpMethod Method, string Uri, string Body);

    /// <summary>Telegram Bot API stand-in: records requests and answers with <see cref="Status"/>.</summary>
    private sealed class RecordingHandler : HttpMessageHandler
    {
        public ConcurrentQueue<RecordedRequest> Requests { get; } = new();

        public HttpStatusCode Status { get; set; } = HttpStatusCode.OK;

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var body = request.Content is null ? "" : await request.Content.ReadAsStringAsync(cancellationToken);
            Requests.Enqueue(new(request.Method, request.RequestUri!.ToString(), body));
            return new HttpResponseMessage(Status)
            {
                Content = new StringContent(Status == HttpStatusCode.OK ? """{"ok":true}""" : """{"ok":false}""", Encoding.UTF8, "application/json"),
            };
        }
    }

    private sealed class CapturingProcessor(ConcurrentQueue<Activity> sink) : BaseProcessor<Activity>
    {
        public override void OnEnd(Activity data) => sink.Enqueue(data);
    }
}
