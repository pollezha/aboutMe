using Contracts.Live;
using Microsoft.AspNetCore.SignalR;

namespace LiveHub.Live;

// Рассылка всем клиентам /hubs/live (design §5.6): counters — не чаще раза в секунду и только при изменениях
// (новые события или сессия выпала из онлайна), metrics — раз в 10 с (до этапа 5 — заглушка без данных).
public sealed partial class LiveBroadcaster(
    LiveState state,
    IHubContext<Hubs.LiveHub> hub,
    TimeProvider time,
    ILogger<LiveBroadcaster> logger) : BackgroundService
{
    public static readonly TimeSpan CountersInterval = TimeSpan.FromSeconds(1);
    public const int MetricsEveryTicks = 10;

    private int _dirty;

    // Вызывает консьюмер, когда LiveState изменился; рассылка — на ближайшем тике.
    public void MarkDirty() => Volatile.Write(ref _dirty, 1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(CountersInterval, time);
        var lastOnline = -1;
        var tick = 0;

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                var snapshot = state.Snapshot();
                if (Interlocked.Exchange(ref _dirty, 0) == 1 || snapshot.Online != lastOnline)
                {
                    await hub.Clients.All.SendAsync(LiveHubMethods.Counters, snapshot, stoppingToken);
                    lastOnline = snapshot.Online;
                }

                if (++tick % MetricsEveryTicks == 0)
                {
                    await hub.Clients.All.SendAsync(
                        LiveHubMethods.Metrics, LiveMetrics.Unavailable(time.GetUtcNow()), stoppingToken);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                LogBroadcastFailed(ex);
            }
        }
    }

    [LoggerMessage(Level = LogLevel.Error, Message = "Broadcast to /hubs/live failed")]
    private partial void LogBroadcastFailed(Exception exception);
}
