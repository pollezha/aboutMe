using System.Text.Json;
using Confluent.Kafka;
using Contracts;
using Contracts.Events;
using Projector.Infrastructure.Messaging;
using Xunit;

namespace Projector.Tests.Infrastructure;

public sealed class SiteEventDeserializerTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not json")]
    [InlineData("""{"eventId":"00000000-0000-0000-0000-000000000000","type":"visit"}""")]
    [InlineData("""{"eventId":"0193a7b0-0000-7000-8000-000000000001"}""")]
    public void Poison_message_is_null(string? value) =>
        Assert.Null(SiteEventDeserializer.Deserialize(Result(value)));

    [Fact]
    public void Valid_event_is_deserialized()
    {
        var noon = new DateTimeOffset(2026, 10, 20, 12, 0, 0, TimeSpan.Zero);
        using var payload = JsonDocument.Parse("""{"source":"hh"}""");
        var sent = new SiteEvent(
            Guid.CreateVersion7(), EventTypes.Visit, noon, noon, "hash", Langs.En, Themes.Day, Devices.Desktop,
            payload.RootElement.Clone());

        var received = SiteEventDeserializer.Deserialize(Result(JsonSerializer.Serialize(sent, SiteEventJsonContext.Default.SiteEvent)));

        Assert.NotNull(received);
        Assert.Equal(sent.EventId, received.EventId);
        Assert.Equal(EventTypes.Visit, received.Type);
    }

    private static ConsumeResult<string, string> Result(string? value) =>
        new() { Message = new Message<string, string> { Value = value! } };
}
