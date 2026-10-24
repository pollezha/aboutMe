using Contracts.Live;
using LiveHub.Application.GetLiveSnapshot;
using Microsoft.AspNetCore.SignalR;

namespace LiveHub.Api.Hubs;

// /hubs/live (design §5.6): при подключении — снапшот счётчиков и метрики; дальше рассылает LiveBroadcastWorker.
// Клиент ничего не вызывает на сервере.
public sealed class LiveHub(GetLiveSnapshotHandler snapshots, TimeProvider time) : Hub
{
    public const string Path = "/hubs/live";

    public override async Task OnConnectedAsync()
    {
        var snapshot = await snapshots.HandleAsync(new GetLiveSnapshotQuery(), Context.ConnectionAborted);
        await Clients.Caller.SendAsync(LiveHubMethods.Snapshot, snapshot, Context.ConnectionAborted);
        await Clients.Caller.SendAsync(
            LiveHubMethods.Metrics, LiveMetrics.Unavailable(time.GetUtcNow()), Context.ConnectionAborted);
        await base.OnConnectedAsync();
    }
}
