using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Gateway.Infrastructure.Health;

// Проверка /health одного бэкенда для сводного /health gateway. Результат кэшируется,
// чтобы частые пробы (smoke CD, алерты) не множили запросы к сервисам.
internal sealed class BackendHealthCheck(
    BackendHealthClient client,
    Uri healthUri,
    TimeSpan timeout,
    TimeSpan cacheDuration,
    TimeProvider timeProvider) : IHealthCheck
{
    // Ссылочный тип: запись и чтение кэша атомарны при параллельных пробах
    private volatile CachedResult? cached;

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        if (cached is { } entry && timeProvider.GetUtcNow() < entry.ExpiresAt)
        {
            return entry.Result;
        }

        var result = await client.ProbeAsync(healthUri, timeout, cancellationToken);
        cached = new CachedResult(result, timeProvider.GetUtcNow() + cacheDuration);
        return result;
    }

    private sealed record CachedResult(HealthCheckResult Result, DateTimeOffset ExpiresAt);
}
