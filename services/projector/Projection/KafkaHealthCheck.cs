using Confluent.Kafka;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Projector.Projection;

/// <summary>
/// Готовность Kafka: брокер отдаёт метаданные. Проверка Aspire.Confluent.Kafka отключена — она пишет
/// сообщение в служебный топик на каждую пробу, а нам достаточно чтения метаданных.
/// </summary>
public sealed class KafkaHealthCheck(string bootstrapServers) : IHealthCheck, IDisposable
{
    private static readonly TimeSpan MetadataTimeout = TimeSpan.FromSeconds(2);

    private readonly Lazy<IAdminClient> _admin = new(() =>
        new AdminClientBuilder(new AdminClientConfig { BootstrapServers = bootstrapServers }).Build());

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            // GetMetadata синхронный и блокирует до таймаута
            var metadata = await Task.Run(() => _admin.Value.GetMetadata(MetadataTimeout), cancellationToken);
            return metadata.Brokers.Count > 0
                ? HealthCheckResult.Healthy()
                : HealthCheckResult.Unhealthy("Kafka returned no brokers");
        }
        catch (KafkaException ex)
        {
            return HealthCheckResult.Unhealthy("Kafka metadata is unavailable", ex);
        }
    }

    public void Dispose()
    {
        if (_admin.IsValueCreated)
        {
            _admin.Value.Dispose();
        }
    }
}
