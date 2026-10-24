using Contracts.Events;

namespace EventsApi.Domain;

/// <summary>Device class from the <c>User-Agent</c> header; only the class goes further, the UA itself is dropped.</summary>
public static class DeviceClass
{
    private static readonly string[] MobileMarkers = ["Mobile", "Android", "iPhone", "iPad"];

    public static string FromUserAgent(string? userAgent) =>
        userAgent is not null && Array.Exists(MobileMarkers, m => userAgent.Contains(m, StringComparison.OrdinalIgnoreCase))
            ? Devices.Mobile
            : Devices.Desktop;
}
