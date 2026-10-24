using Microsoft.Extensions.DependencyInjection;
using OpenTelemetry.Trace;

namespace BuildingBlocks.Messaging.Kafka;

public static class KafkaTracingExtensions
{
    /// <summary>
    /// Подписывает трейсинг сервиса на спаны produce/process из <see cref="KafkaTracePropagation"/>.
    /// Вызывается каждым Kafka-сервисом: ServiceDefaults о Kafka не знает (ADR-0007).
    /// </summary>
    public static IServiceCollection AddKafkaTracing(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        return services.ConfigureOpenTelemetryTracerProvider(
            tracing => tracing.AddSource(KafkaTracePropagation.ActivitySourceName));
    }
}
