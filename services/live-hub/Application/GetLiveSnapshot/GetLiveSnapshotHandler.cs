using Contracts.Live;
using LiveHub.Application.Abstractions;

namespace LiveHub.Application.GetLiveSnapshot;

public sealed class GetLiveSnapshotHandler(ILiveStateRepository state)
{
    public Task<LiveSnapshot> HandleAsync(GetLiveSnapshotQuery query, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        return Task.FromResult(state.GetSnapshot());
    }
}
