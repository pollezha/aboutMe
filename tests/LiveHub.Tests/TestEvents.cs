using System.Text.Json;
using Contracts.Events;

namespace LiveHub.Tests;

internal static class TestEvents
{
    public static SiteEvent Event(
        string sessionHash,
        DateTimeOffset receivedAt,
        string type = EventTypes.Visit,
        string payload = """{"source":"direct"}""") =>
        new(
            Guid.CreateVersion7(),
            type,
            receivedAt,
            receivedAt,
            sessionHash,
            Langs.En,
            Themes.Day,
            Devices.Desktop,
            JsonDocument.Parse(payload).RootElement.Clone());
}
