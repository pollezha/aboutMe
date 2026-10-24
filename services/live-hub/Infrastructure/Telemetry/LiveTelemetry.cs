using System.Diagnostics.Metrics;

namespace LiveHub.Infrastructure.Telemetry;

// Метрики live-hub; meter регистрируется в OpenTelemetry в Infrastructure/DependencyInjection.cs.
// Счётчик ядовитых сообщений live_poison_total создаёт KafkaConsumerLoop на этом же meter.
public sealed class LiveTelemetry
{
    public const string MeterName = "aboutMe.LiveHub";
    public const string PoisonCounterName = "live_poison_total";

    private readonly UpDownCounter<long> _connections;

    public LiveTelemetry(IMeterFactory meterFactory)
    {
        ArgumentNullException.ThrowIfNull(meterFactory);

        Meter = meterFactory.Create(MeterName);
        _connections = Meter.CreateUpDownCounter<long>(
            "signalr_connections", description: "Open SignalR connections to /hubs/live");
    }

    public Meter Meter { get; }

    public void ConnectionOpened() => _connections.Add(1);

    public void ConnectionClosed() => _connections.Add(-1);
}
