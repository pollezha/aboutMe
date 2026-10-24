using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace ContentApi.Seeding;

/// <summary>Итог сида при старте; health check <c>content</c> отражает его в <c>/health</c>.</summary>
public sealed class ContentSeedState
{
    private readonly Lock _lock = new();
    private HealthCheckResult _result = HealthCheckResult.Unhealthy("Content seeding has not completed");

    public HealthCheckResult Result
    {
        get
        {
            lock (_lock)
            {
                return _result;
            }
        }
    }

    public void Succeeded(string description) => Set(HealthCheckResult.Healthy(description));

    public void Failed(string description) => Set(HealthCheckResult.Unhealthy(description));

    private void Set(HealthCheckResult result)
    {
        lock (_lock)
        {
            _result = result;
        }
    }
}

public sealed class ContentSeedHealthCheck(ContentSeedState state) : IHealthCheck
{
    public const string Name = "content";

    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default) =>
        Task.FromResult(state.Result);
}
