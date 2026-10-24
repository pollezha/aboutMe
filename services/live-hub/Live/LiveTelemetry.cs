using System.Diagnostics.Metrics;

namespace LiveHub.Live;

// Метрики live-hub; meter регистрируется в OpenTelemetry в Program.cs.
public sealed class LiveTelemetry
{
    public const string MeterName = "aboutMe.LiveHub";

    private readonly Counter<long> _poison;
    private readonly UpDownCounter<long> _connections;

    public LiveTelemetry(IMeterFactory meterFactory)
    {
        ArgumentNullException.ThrowIfNull(meterFactory);

        var meter = meterFactory.Create(MeterName);
        _poison = meter.CreateCounter<long>(
            "live_poison_total", description: "Messages of site.events.v1 that live-hub could not deserialize");
        _connections = meter.CreateUpDownCounter<long>(
            "signalr_connections", description: "Open SignalR connections to /hubs/live");
    }

    public void PoisonMessage() => _poison.Add(1);

    public void ConnectionOpened() => _connections.Add(1);

    public void ConnectionClosed() => _connections.Add(-1);
}
