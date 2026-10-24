using Contracts.Live;
using LiveHub.Live;
using Microsoft.AspNetCore.SignalR;

namespace LiveHub.Hubs;

// /hubs/live (design §5.6): при подключении — снапшот счётчиков и метрики; дальше рассылает LiveBroadcaster.
// Клиент ничего не вызывает на сервере.
public sealed class LiveHub(LiveState state, LiveTelemetry telemetry, TimeProvider time) : Hub
{
    public const string Path = "/hubs/live";

    public override async Task OnConnectedAsync()
    {
        await Clients.Caller.SendAsync(LiveHubMethods.Snapshot, state.Snapshot(), Context.ConnectionAborted);
        await Clients.Caller.SendAsync(
            LiveHubMethods.Metrics, LiveMetrics.Unavailable(time.GetUtcNow()), Context.ConnectionAborted);
        await base.OnConnectedAsync();
        telemetry.ConnectionOpened();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        telemetry.ConnectionClosed();
        return base.OnDisconnectedAsync(exception);
    }
}
