using System.Text.Json;
using Contracts.Events;
using LiveHub.Domain;
using Xunit;
using static LiveHub.Tests.TestEvents;

namespace LiveHub.Tests.Domain;

public sealed class LiveStateTests
{
    private static readonly DateTimeOffset Noon = new(2026, 10, 20, 12, 0, 0, TimeSpan.Zero);

    private readonly ManualTimeProvider _time = new(Noon);
    private readonly LiveState _state;

    public LiveStateTests() => _state = new LiveState(_time);

    [Fact]
    public void Two_events_of_one_session_and_one_of_another_make_two_online()
    {
        _state.Apply(Event("session-a", Noon));
        _state.Apply(Event("session-a", Noon));
        _state.Apply(Event("session-b", Noon));

        var snapshot = _state.Snapshot();

        Assert.Equal(2, snapshot.Online);
        Assert.Equal(3, snapshot.EventsToday);
    }

    [Fact]
    public void Session_last_seen_six_minutes_ago_is_not_online()
    {
        _state.Apply(Event("old", Noon.AddMinutes(-6)));
        _state.Apply(Event("recent", Noon.AddMinutes(-4)));

        Assert.Equal(1, _state.Snapshot().Online);
    }

    [Fact]
    public void Session_drops_out_of_online_when_time_passes()
    {
        _state.Apply(Event("a", Noon));

        _time.Now = Noon.AddMinutes(6);

        var snapshot = _state.Snapshot();
        Assert.Equal(0, snapshot.Online);
        Assert.Equal(1, snapshot.EventsToday);
    }

    [Fact]
    public void New_utc_day_resets_today_counters()
    {
        _state.Apply(Event("a", Noon, EventTypes.StopOpened, """{"stop":"about"}"""));

        _time.Now = new DateTimeOffset(2026, 10, 21, 0, 0, 1, TimeSpan.Zero);

        var snapshot = _state.Snapshot();
        Assert.Equal(0, snapshot.EventsToday);
        Assert.Empty(snapshot.ByType);
        Assert.Empty(snapshot.ByStop);
    }

    [Fact]
    public void Event_received_yesterday_is_not_counted_today()
    {
        var changed = _state.Apply(Event("a", Noon.AddDays(-1)));

        Assert.False(changed);
        Assert.Equal(0, _state.Snapshot().EventsToday);
    }

    [Fact]
    public void Counts_today_by_type_stop_and_cta()
    {
        _state.Apply(Event("a", Noon, EventTypes.StopOpened, """{"stop":"about"}"""));
        _state.Apply(Event("a", Noon, EventTypes.StopOpened, """{"stop":"about"}"""));
        _state.Apply(Event("b", Noon, EventTypes.StopOpened, """{"stop":"stack"}"""));
        _state.Apply(Event("b", Noon, EventTypes.CtaClick, """{"cta":"cv"}"""));
        _state.Apply(Event("b", Noon, EventTypes.Visit, """{"source":"hh"}"""));

        var snapshot = _state.Snapshot();

        Assert.Equal(5, snapshot.EventsToday);
        Assert.Equal(3, snapshot.ByType[EventTypes.StopOpened]);
        Assert.Equal(1, snapshot.ByType[EventTypes.CtaClick]);
        Assert.Equal(1, snapshot.ByType[EventTypes.Visit]);
        Assert.Equal(2, snapshot.ByStop["about"]);
        Assert.Equal(1, snapshot.ByStop["stack"]);
        Assert.Equal(1, snapshot.ByCta["cv"]);
        Assert.Equal(Noon, snapshot.AsOf);
    }

    [Fact]
    public void Redelivered_event_is_counted_once()
    {
        var e = Event("a", Noon);

        Assert.True(_state.Apply(e));
        Assert.False(_state.Apply(e));

        Assert.Equal(1, _state.Snapshot().EventsToday);
    }

    [Fact]
    public void Snapshot_is_a_copy_not_affected_by_later_events()
    {
        _state.Apply(Event("a", Noon, EventTypes.StopOpened, """{"stop":"about"}"""));
        var before = _state.Snapshot();

        _state.Apply(Event("a", Noon, EventTypes.StopOpened, """{"stop":"about"}"""));

        Assert.Equal(1, before.ByStop["about"]);
    }

    [Fact]
    public void Stop_or_cta_with_an_unpaired_surrogate_is_not_counted()
    {
        _state.Apply(Event("a", Noon, EventTypes.StopOpened, """{"stop":"\ud800"}"""));
        _state.Apply(Event("a", Noon, EventTypes.CtaClick, """{"cta":"\udfff"}"""));

        var snapshot = _state.Snapshot();

        Assert.Empty(snapshot.ByStop);
        Assert.Empty(snapshot.ByCta);
        Assert.Equal(2, snapshot.EventsToday);
    }
}
