using Contracts.Live;
using LiveHub.Application.Abstractions;
using LiveHub.Application.GetLiveSnapshot;

namespace LiveHub.Workers;

// Рассылка всем клиентам /hubs/live (design §5.6): counters — не чаще раза в секунду и только при изменениях
// (новые события, сессия выпала из онлайна, обнуление счётчиков при смене UTC-суток), metrics — раз в 10 с
// (до этапа 5 — заглушка без данных).
public sealed partial class LiveBroadcastWorker(
    GetLiveSnapshotHandler snapshots,
    ILiveNotifier notifier,
    TimeProvider time,
    ILogger<LiveBroadcastWorker> logger) : BackgroundService
{
    public static readonly TimeSpan CountersInterval = TimeSpan.FromSeconds(1);
    public const int MetricsEveryTicks = 10;

    private int _dirty;

    // Последний разосланный снапшот (тики идут последовательно, синхронизация не нужна)
    private LiveSnapshot? _lastSent;
    private int _tick;

    // Вызывает консьюмер, когда счётчики изменились; рассылка — на ближайшем тике.
    public void MarkCountersDirty() => Volatile.Write(ref _dirty, 1);

    // Один тик рассылки; вызывается раз в CountersInterval, между вызовами — не параллельно.
    public async Task TickAsync(CancellationToken cancellationToken)
    {
        // Сначала сброс, потом снапшот: изменение, пришедшее во время снятия, оставит флаг для следующего тика
        var dirty = Interlocked.Exchange(ref _dirty, 0) == 1;
        var snapshot = await snapshots.HandleAsync(new GetLiveSnapshotQuery(), cancellationToken);
        if (dirty || IsChanged(snapshot))
        {
            await notifier.BroadcastCountersAsync(snapshot, cancellationToken);
            _lastSent = snapshot;
        }

        if (++_tick % MetricsEveryTicks == 0)
        {
            await notifier.BroadcastMetricsAsync(LiveMetrics.Unavailable(time.GetUtcNow()), cancellationToken);
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(CountersInterval, time);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await TickAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                LogBroadcastFailed(ex);
            }
        }
    }

    // Изменения без событий: сессия выпала из окна онлайна или счётчики обнулились с новыми UTC-сутками
    private bool IsChanged(LiveSnapshot snapshot) =>
        _lastSent is null
        || snapshot.Online != _lastSent.Online
        || snapshot.EventsToday != _lastSent.EventsToday
        || snapshot.AsOf.UtcDateTime.Date != _lastSent.AsOf.UtcDateTime.Date;

    [LoggerMessage(Level = LogLevel.Error, Message = "Broadcast to /hubs/live failed")]
    private partial void LogBroadcastFailed(Exception exception);
}
