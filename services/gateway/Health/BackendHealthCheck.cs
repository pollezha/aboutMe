using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Gateway.Health;

// Проверка /health одного бэкенда для сводного /health gateway. Результат кэшируется,
// чтобы частые пробы (smoke CD, алерты) не множили запросы к сервисам.
internal sealed class BackendHealthCheck(
    IHttpClientFactory httpClientFactory,
    Uri healthUri,
    TimeSpan timeout,
    TimeSpan cacheDuration,
    TimeProvider timeProvider) : IHealthCheck
{
    public const string HttpClientName = "gateway-health";

    // Ссылочный тип: запись и чтение кэша атомарны при параллельных пробах
    private volatile CachedResult? cached;

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        if (cached is { } entry && timeProvider.GetUtcNow() < entry.ExpiresAt)
        {
            return entry.Result;
        }

        var result = await ProbeAsync(cancellationToken);
        cached = new CachedResult(result, timeProvider.GetUtcNow() + cacheDuration);
        return result;
    }

    private async Task<HealthCheckResult> ProbeAsync(CancellationToken cancellationToken)
    {
        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(timeout);

        try
        {
            using var client = httpClientFactory.CreateClient(HttpClientName);
            using var response = await client.GetAsync(healthUri, timeoutCts.Token);
            return response.IsSuccessStatusCode
                ? HealthCheckResult.Healthy()
                : HealthCheckResult.Unhealthy($"HTTP {(int)response.StatusCode}");
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return HealthCheckResult.Unhealthy("Timeout");
        }
        catch (HttpRequestException)
        {
            return HealthCheckResult.Unhealthy("Unreachable");
        }
    }

    private sealed record CachedResult(HealthCheckResult Result, DateTimeOffset ExpiresAt);
}
