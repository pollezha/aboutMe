using ContentApi.Application.Abstractions;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace ContentApi.Infrastructure.Health;

/// <summary>Итог сида при старте; health check <c>content</c> отражает его в <c>/health</c>.</summary>
public sealed class ContentSeedState : IContentSeedState
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
