using Contracts.Events;
using Contracts.Live;
using LiveHub.Application.Abstractions;
using LiveHub.Application.GetLiveSnapshot;
using LiveHub.Domain;
using LiveHub.Infrastructure.InMemory;
using LiveHub.Workers;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;
using static LiveHub.Tests.TestEvents;

namespace LiveHub.Tests.Workers;

// Тик рассылки вызывается напрямую: интервал 1 с задаёт PeriodicTimer в ExecuteAsync.
public sealed class LiveBroadcastWorkerTests
{
    private static readonly DateTimeOffset Noon = new(2026, 10, 20, 12, 0, 0, TimeSpan.Zero);

    private readonly ManualTimeProvider _time = new(Noon);
    private readonly InMemoryLiveStateRepository _repository;
    private readonly RecordingNotifier _notifier = new();
    private readonly LiveBroadcastWorker _worker;

    public LiveBroadcastWorkerTests()
    {
        _repository = new InMemoryLiveStateRepository(_time);
        _worker = CreateWorker(_repository);
    }

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public void Counters_tick_is_one_second_and_metrics_every_ten_ticks()
    {
        Assert.Equal(TimeSpan.FromSeconds(1), LiveBroadcastWorker.CountersInterval);
        Assert.Equal(10, LiveBroadcastWorker.MetricsEveryTicks);
    }

    [Fact]
    public async Task Five_changes_within_one_tick_are_broadcast_once()
    {
        await _worker.TickAsync(Ct);
        _notifier.Counters.Clear();

        for (var i = 0; i < 5; i++)
        {
            _repository.Apply(Event($"s{i}", Noon, EventTypes.StopOpened, """{"stop":"about"}"""));
            _worker.MarkCountersDirty();
        }

        await _worker.TickAsync(Ct);

        var sent = Assert.Single(_notifier.Counters);
        Assert.Equal(5, sent.EventsToday);
        Assert.Equal(5, sent.ByStop["about"]);
    }

    [Fact]
    public async Task Tick_without_changes_broadcasts_nothing()
    {
        _repository.Apply(Event("a", Noon));
        _worker.MarkCountersDirty();
        await _worker.TickAsync(Ct);
        _notifier.Counters.Clear();

        _time.Now = Noon.AddSeconds(1);
        await _worker.TickAsync(Ct);
        _time.Now = Noon.AddSeconds(2);
        await _worker.TickAsync(Ct);

        Assert.Empty(_notifier.Counters);
    }

    [Fact]
    public async Task Session_leaving_the_online_window_is_broadcast_without_new_events()
    {
        _repository.Apply(Event("a", Noon));
        _worker.MarkCountersDirty();
        await _worker.TickAsync(Ct);
        _notifier.Counters.Clear();

        _time.Now = Noon + LiveState.OnlineWindow + TimeSpan.FromSeconds(1);
        await _worker.TickAsync(Ct);

        var sent = Assert.Single(_notifier.Counters);
        Assert.Equal(0, sent.Online);
    }

    [Fact]
    public async Task Midnight_without_events_broadcasts_reset_counters_once()
    {
        var lateEvening = new DateTimeOffset(2026, 10, 20, 23, 59, 59, TimeSpan.Zero);
        _time.Now = lateEvening;
        _repository.Apply(Event("a", lateEvening, EventTypes.StopOpened, """{"stop":"about"}"""));
        _worker.MarkCountersDirty();
        await _worker.TickAsync(Ct);
        _notifier.Counters.Clear();

        _time.Now = lateEvening.AddSeconds(1);
        await _worker.TickAsync(Ct);
        _time.Now = lateEvening.AddSeconds(2);
        await _worker.TickAsync(Ct);

        var sent = Assert.Single(_notifier.Counters);
        Assert.Equal(0, sent.EventsToday);
        Assert.Empty(sent.ByStop);
        Assert.Equal(1, sent.Online);
    }

    [Fact]
    public async Task Change_made_while_the_snapshot_is_taken_is_broadcast_on_the_next_tick()
    {
        var before = Snapshot(byStop: 1);
        var after = Snapshot(byStop: 2);
        LiveBroadcastWorker? worker = null;
        var repository = new ScriptedRepository(
            () =>
            {
                // Консьюмер применил событие, пока рассылка уже читает снапшот
                worker!.MarkCountersDirty();
                return before;
            },
            () => after);
        worker = CreateWorker(repository);

        await worker.TickAsync(Ct);
        await worker.TickAsync(Ct);

        Assert.Equal([before, after], _notifier.Counters);
    }

    [Fact]
    public async Task Metrics_are_broadcast_once_per_ten_ticks()
    {
        for (var i = 0; i < 9; i++)
        {
            await _worker.TickAsync(Ct);
        }

        Assert.Empty(_notifier.Metrics);

        await _worker.TickAsync(Ct);

        var metrics = Assert.Single(_notifier.Metrics);
        Assert.False(metrics.Available);

        for (var i = 0; i < 10; i++)
        {
            await _worker.TickAsync(Ct);
        }

        Assert.Equal(2, _notifier.Metrics.Count);
    }

    private LiveBroadcastWorker CreateWorker(ILiveStateRepository repository) =>
        new(new GetLiveSnapshotHandler(repository), _notifier, _time, NullLogger<LiveBroadcastWorker>.Instance);

    private static LiveSnapshot Snapshot(int byStop) =>
        new(1, 1, new() { [EventTypes.StopOpened] = 1 }, new() { ["about"] = byStop }, [], Noon);

    private sealed class RecordingNotifier : ILiveNotifier
    {
        public List<LiveSnapshot> Counters { get; } = [];

        public List<LiveMetrics> Metrics { get; } = [];

        public Task BroadcastCountersAsync(LiveSnapshot snapshot, CancellationToken cancellationToken)
        {
            Counters.Add(snapshot);
            return Task.CompletedTask;
        }

        public Task BroadcastMetricsAsync(LiveMetrics metrics, CancellationToken cancellationToken)
        {
            Metrics.Add(metrics);
            return Task.CompletedTask;
        }
    }

    // Снапшоты по очереди; последний повторяется
    private sealed class ScriptedRepository(params Func<LiveSnapshot>[] snapshots) : ILiveStateRepository
    {
        private int _next;

        public bool Apply(SiteEvent siteEvent) => throw new NotSupportedException();

        public LiveSnapshot GetSnapshot() => snapshots[Math.Min(_next++, snapshots.Length - 1)]();
    }
}
