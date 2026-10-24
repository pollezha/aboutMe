using System.Text.Json;
using Contracts.Events;
using EventsApi.Application.SendContactMessage;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace EventsApi.Tests.Application;

public sealed class SendContactMessageHandlerTests
{
    private const string Name = "Alice Recruiter";
    private const string ReplyTo = "alice@example.org";
    private const string Text = "Hi Yakov! We have a .NET role for you";
    private const string SessionId = "sess-bottle-handler";

    private static readonly DateTimeOffset Now = new(2026, 10, 20, 12, 0, 0, TimeSpan.Zero);

    private readonly FakeEventPublisher _publisher = new();
    private readonly FakeContactMessageDelivery _delivery = new();
    private readonly SendContactMessageHandler _handler;

    public SendContactMessageHandlerTests()
    {
        var clock = new ManualTimeProvider(Now);
        _handler = new SendContactMessageHandler(
            _delivery,
            new EventValidator(clock),
            new FixedDailySalt(),
            _publisher,
            clock,
            NullLogger<SendContactMessageHandler>.Instance);
    }

    [Fact]
    public async Task Valid_message_is_delivered_once_trimmed()
    {
        var result = await HandleAsync(Command() with { Name = $"  {Name} " });

        Assert.IsType<SendContactMessageResult.Delivered>(result);
        var delivered = Assert.Single(_delivery.Delivered);
        Assert.Equal(Name, delivered.Name);
        Assert.Equal(ReplyTo, delivered.ReplyTo);
        Assert.Equal(Text, delivered.Text);
    }

    [Fact]
    public async Task Filled_honeypot_is_ignored_without_delivery_or_event()
    {
        var result = await HandleAsync(Command(SessionId) with { Website = "http://spam.example" });

        Assert.IsType<SendContactMessageResult.Ignored>(result);
        Assert.Empty(_delivery.Delivered);
        Assert.Empty(_publisher.Published);
    }

    [Fact]
    public async Task Invalid_fields_fail_by_field_without_delivery()
    {
        var result = await HandleAsync(Command() with { ReplyTo = "alice", Text = "  " });

        var failed = Assert.IsType<SendContactMessageResult.ValidationFailed>(result);
        Assert.Equal(["replyTo", "text"], failed.Errors.Keys.Order(StringComparer.Ordinal));
        Assert.Empty(_delivery.Delivered);
    }

    [Fact]
    public async Task Delivery_failure_gives_delivery_failed_and_no_event()
    {
        _delivery.Failure = new HttpRequestException("telegram is down");

        var result = await HandleAsync(Command(SessionId));

        Assert.IsType<SendContactMessageResult.DeliveryFailed>(result);
        Assert.Empty(_publisher.Published);
    }

    [Fact]
    public async Task Delivered_message_with_session_publishes_bottle_click_without_message_content()
    {
        var result = await HandleAsync(Command(SessionId) with { UserAgent = "Mozilla/5.0 (Linux; Android 15) Mobile" });

        Assert.IsType<SendContactMessageResult.Delivered>(result);
        var published = Assert.Single(_publisher.Published);
        Assert.Equal(EventTypes.CtaClick, published.Type);
        Assert.Equal(CtaTargets.Bottle, published.Payload.GetProperty("cta").GetString());
        Assert.Equal(Devices.Mobile, published.Device);
        var json = JsonSerializer.Serialize(published, SiteEventJsonContext.Default.SiteEvent);
        foreach (var secret in new[] { Name, ReplyTo, Text, SessionId })
        {
            Assert.DoesNotContain(secret, json, StringComparison.Ordinal);
        }
    }

    [Fact]
    public async Task Publisher_failure_does_not_break_delivery()
    {
        _publisher.Failure = new TimeoutException("delivery timed out");

        var result = await HandleAsync(Command(SessionId));

        Assert.IsType<SendContactMessageResult.Delivered>(result);
        Assert.Single(_delivery.Delivered);
    }

    private Task<SendContactMessageResult> HandleAsync(SendContactMessageCommand command) =>
        _handler.HandleAsync(command, TestContext.Current.CancellationToken);

    private static SendContactMessageCommand Command(string? sessionId = null) => new(
        Name,
        ReplyTo,
        Text,
        Website: "",
        sessionId,
        Lang: sessionId is null ? null : "en",
        Theme: sessionId is null ? null : "night",
        UserAgent: null);
}
