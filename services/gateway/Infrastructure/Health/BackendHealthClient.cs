using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Gateway.Infrastructure.Health;

// Один запрос к /health бэкенда с таймаутом; без повторов (клиент зарегистрирован без resilience-хендлера)
internal sealed class BackendHealthClient(IHttpClientFactory httpClientFactory)
{
    public const string HttpClientName = "gateway-health";

    public async Task<HealthCheckResult> ProbeAsync(Uri healthUri, TimeSpan timeout, CancellationToken cancellationToken)
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
}
