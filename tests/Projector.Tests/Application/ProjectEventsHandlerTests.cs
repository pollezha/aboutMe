using System.Diagnostics;
using System.Text.Json;
using BuildingBlocks.Persistence;
using Contracts;
using Contracts.Events;
using Projector.Application.Abstractions;
using Projector.Application.ProjectEvents;
using Projector.Domain;
using Xunit;

namespace Projector.Tests.Application;

public sealed class ProjectEventsHandlerTests : IAsyncDisposable
{
    private static readonly DateTimeOffset Noon = new(2026, 10, 20, 12, 0, 0, TimeSpan.Zero);

    private readonly FakeUnitOfWork _unitOfWork = new();
    private readonly FakeProcessedEvents _processed = new();
    private readonly FakeStats _stats = new();

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task New_events_are_projected_in_one_committed_transaction()
    {
        var handler = CreateHandler();

        var fresh = await handler.HandleAsync(Command(StopOpened("profile"), StopOpened("profile"), StopOpened("skills")), Ct);

        Assert.Equal(3, fresh);
        Assert.Equal(1, _unitOfWork.Begins);
        Assert.Equal(1, _unitOfWork.Commits);
        var deltas = Assert.Single(_stats.Applied);
        Assert.Equal(
            [new StopOpenDelta(new DateOnly(2026, 10, 20), "profile", 2), new StopOpenDelta(new DateOnly(2026, 10, 20), "skills", 1)],
            deltas.Cast<StopOpenDelta>().OrderBy(d => d.Stop, StringComparer.Ordinal));
    }

    [Fact]
    public async Task Redelivered_event_produces_no_delta()
    {
        var siteEvent = StopOpened("profile");
        await CreateHandler().HandleAsync(Command(siteEvent), Ct);

        var fresh = await CreateHandler().HandleAsync(Command(siteEvent), Ct);

        Assert.Equal(0, fresh);
        Assert.Single(_stats.Applied);
        Assert.Equal(2, _unitOfWork.Commits);
    }

    [Fact]
    public async Task Duplicate_inside_a_batch_counts_once()
    {
        var siteEvent = StopOpened("profile");

        var fresh = await CreateHandler().HandleAsync(Command(siteEvent, siteEvent), Ct);

        Assert.Equal(1, fresh);
        var delta = Assert.IsType<StopOpenDelta>(Assert.Single(Assert.Single(_stats.Applied)));
        Assert.Equal(1, delta.N);
    }

    [Fact]
    public async Task Failure_while_applying_deltas_leaves_the_transaction_uncommitted()
    {
        _stats.FailWith = new InvalidOperationException("db is down");

        await Assert.ThrowsAsync<InvalidOperationException>(() => CreateHandler().HandleAsync(Command(StopOpened("profile")), Ct));

        Assert.Equal(1, _unitOfWork.Begins);
        Assert.Equal(0, _unitOfWork.Commits);
    }

    [Fact]
    public async Task Empty_batch_does_not_touch_the_store()
    {
        var fresh = await CreateHandler().HandleAsync(Command(), Ct);

        Assert.Equal(0, fresh);
        Assert.Equal(0, _unitOfWork.Begins);
        Assert.Empty(_stats.Applied);
    }

    public ValueTask DisposeAsync() => _unitOfWork.DisposeAsync();

    private ProjectEventsHandler CreateHandler() => new(_unitOfWork, _processed, _stats);

    private static ProjectEventsCommand Command(params SiteEvent[] events) => new(events, Array.Empty<ActivityLink>());

    private static SiteEvent StopOpened(string stop)
    {
        using var doc = JsonDocument.Parse($$"""{"stop":"{{stop}}"}""");
        return new SiteEvent(
            Guid.CreateVersion7(), EventTypes.StopOpened, Noon, Noon, "hash", Langs.En, Themes.Day, Devices.Desktop,
            doc.RootElement.Clone());
    }

    private sealed class FakeUnitOfWork : IUnitOfWork
    {
        public int Begins { get; private set; }

        public int Commits { get; private set; }

        public Task BeginAsync(CancellationToken cancellationToken)
        {
            Begins++;
            return Task.CompletedTask;
        }

        public Task CommitAsync(CancellationToken cancellationToken)
        {
            Commits++;
            return Task.CompletedTask;
        }

        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
    }

    /// <summary>Как <c>ON CONFLICT DO NOTHING RETURNING</c>: новыми возвращаются только незнакомые id.</summary>
    private sealed class FakeProcessedEvents : IProcessedEventsRepository
    {
        private readonly HashSet<Guid> _seen = [];

        public Task<IReadOnlySet<Guid>> MarkProcessedAsync(IReadOnlyCollection<Guid> eventIds, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlySet<Guid>>(eventIds.Where(_seen.Add).ToHashSet());
    }

    private sealed class FakeStats : IStatsRepository
    {
        public List<IReadOnlyCollection<StatsDelta>> Applied { get; } = [];

        public Exception? FailWith { get; set; }

        public Task ApplyDeltasAsync(IReadOnlyCollection<StatsDelta> deltas, CancellationToken cancellationToken)
        {
            if (FailWith is not null)
            {
                throw FailWith;
            }

            Applied.Add(deltas);
            return Task.CompletedTask;
        }

        public Task TruncateAllAsync(CancellationToken cancellationToken) => throw new NotSupportedException();
    }
}
