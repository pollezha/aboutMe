using Contracts.Events;
using LiveHub.Application.ApplyLiveEvent;
using LiveHub.Application.GetLiveSnapshot;
using LiveHub.Infrastructure.InMemory;
using Xunit;
using static LiveHub.Tests.TestEvents;

namespace LiveHub.Tests.Application;

public sealed class ApplyLiveEventHandlerTests
{
    private static readonly DateTimeOffset Noon = new(2026, 10, 20, 12, 0, 0, TimeSpan.Zero);

    private readonly InMemoryLiveStateRepository _repository = new(new ManualTimeProvider(Noon));
    private readonly ApplyLiveEventHandler _apply;
    private readonly GetLiveSnapshotHandler _snapshot;

    public ApplyLiveEventHandlerTests()
    {
        _apply = new ApplyLiveEventHandler(_repository);
        _snapshot = new GetLiveSnapshotHandler(_repository);
    }

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task New_event_changes_the_snapshot()
    {
        var changed = await _apply.HandleAsync(
            new ApplyLiveEventCommand(Event("a", Noon, EventTypes.StopOpened, """{"stop":"about"}""")), Ct);

        Assert.True(changed);
        var snapshot = await _snapshot.HandleAsync(new GetLiveSnapshotQuery(), Ct);
        Assert.Equal(1, snapshot.Online);
        Assert.Equal(1, snapshot.EventsToday);
        Assert.Equal(1, snapshot.ByStop["about"]);
        Assert.Equal(Noon, snapshot.AsOf);
    }

    [Fact]
    public async Task Redelivered_event_id_changes_nothing()
    {
        var command = new ApplyLiveEventCommand(Event("a", Noon));
        await _apply.HandleAsync(command, Ct);

        var changed = await _apply.HandleAsync(command, Ct);

        Assert.False(changed);
        var snapshot = await _snapshot.HandleAsync(new GetLiveSnapshotQuery(), Ct);
        Assert.Equal(1, snapshot.EventsToday);
        Assert.Equal(1, snapshot.ByType[EventTypes.Visit]);
    }

    [Fact]
    public async Task Concurrent_events_are_all_counted()
    {
        await Task.WhenAll(Enumerable.Range(0, 8).Select(worker => Task.Run(async () =>
        {
            for (var i = 0; i < 500; i++)
            {
                await _apply.HandleAsync(new ApplyLiveEventCommand(Event($"s{worker}", Noon)), Ct);
            }
        }, Ct)));

        var snapshot = await _snapshot.HandleAsync(new GetLiveSnapshotQuery(), Ct);
        Assert.Equal(4000, snapshot.EventsToday);
        Assert.Equal(8, snapshot.Online);
    }
}
