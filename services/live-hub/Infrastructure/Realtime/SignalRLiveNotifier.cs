using Contracts.Live;
using LiveHub.Application.Abstractions;
using Microsoft.AspNetCore.SignalR;

namespace LiveHub.Infrastructure.Realtime;

// Рассылка через хаб /hubs/live; единственный адаптер, который знает о SignalR-хабе вне Api.
public sealed class SignalRLiveNotifier(IHubContext<Api.Hubs.LiveHub> hub) : ILiveNotifier
{
    public Task BroadcastCountersAsync(LiveSnapshot snapshot, CancellationToken cancellationToken) =>
        hub.Clients.All.SendAsync(LiveHubMethods.Counters, snapshot, cancellationToken);

    public Task BroadcastMetricsAsync(LiveMetrics metrics, CancellationToken cancellationToken) =>
        hub.Clients.All.SendAsync(LiveHubMethods.Metrics, metrics, cancellationToken);
}
