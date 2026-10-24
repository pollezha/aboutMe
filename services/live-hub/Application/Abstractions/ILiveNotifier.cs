using Contracts.Live;

namespace LiveHub.Application.Abstractions;

/// <summary>Рассылка всем подключённым клиентам живого канала (design §5.6).</summary>
public interface ILiveNotifier
{
    Task BroadcastCountersAsync(LiveSnapshot snapshot, CancellationToken cancellationToken);

    Task BroadcastMetricsAsync(LiveMetrics metrics, CancellationToken cancellationToken);
}
