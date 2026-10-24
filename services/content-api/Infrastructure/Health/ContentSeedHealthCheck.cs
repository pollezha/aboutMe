using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace ContentApi.Infrastructure.Health;

public sealed class ContentSeedHealthCheck(ContentSeedState state) : IHealthCheck
{
    public const string Name = "content";

    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default) =>
        Task.FromResult(state.Result);
}
