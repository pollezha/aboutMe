using BuildingBlocks.Persistence;
using Projector.Application.Abstractions;
using Projector.Application.RebuildStats;
using Projector.Domain;
using Xunit;

namespace Projector.Tests.Application;

public sealed class RebuildStatsHandlerTests : IAsyncDisposable
{
    private readonly FakeOffsets _offsets = new();
    private readonly FakeStats _stats = new();
    private readonly FakeUnitOfWork _unitOfWork = new();

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Resets_offsets_and_truncates_stats_in_a_committed_transaction()
    {
        var result = await CreateHandler().HandleAsync(new RebuildStatsCommand("projector"), Ct);

        Assert.Equal(RebuildStatsResult.Done, result);
        Assert.Equal(["projector"], _offsets.Reset);
        Assert.Equal(1, _stats.Truncates);
        Assert.Equal(1, _unitOfWork.Commits);
    }

    [Fact]
    public async Task Active_group_leaves_stats_untouched()
    {
        _offsets.GroupActive = true;

        var result = await CreateHandler().HandleAsync(new RebuildStatsCommand("projector"), Ct);

        Assert.Equal(RebuildStatsResult.GroupActive, result);
        Assert.Equal(0, _stats.Truncates);
        Assert.Equal(0, _unitOfWork.Begins);
    }

    public ValueTask DisposeAsync() => _unitOfWork.DisposeAsync();

    private RebuildStatsHandler CreateHandler() => new(_offsets, _stats, _unitOfWork);

    private sealed class FakeOffsets : IConsumerOffsets
    {
        public bool GroupActive { get; set; }

        public List<string> Reset { get; } = [];

        public Task<bool> ResetToBeginningAsync(string consumerGroup, CancellationToken cancellationToken)
        {
            if (GroupActive)
            {
                return Task.FromResult(false);
            }

            Reset.Add(consumerGroup);
            return Task.FromResult(true);
        }
    }

    private sealed class FakeStats : IStatsRepository
    {
        public int Truncates { get; private set; }

        public Task ApplyDeltasAsync(IReadOnlyCollection<StatsDelta> deltas, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task TruncateAllAsync(CancellationToken cancellationToken)
        {
            Truncates++;
            return Task.CompletedTask;
        }
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
}
