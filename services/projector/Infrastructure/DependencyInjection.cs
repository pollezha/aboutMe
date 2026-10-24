using BuildingBlocks.Messaging.Kafka;
using BuildingBlocks.Persistence;
using Confluent.Kafka;
using Contracts.Events;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Projector.Application;
using Projector.Application.Abstractions;
using Projector.Infrastructure.Health;
using Projector.Infrastructure.Messaging;
using Projector.Infrastructure.Persistence;

namespace Projector.Infrastructure;

public static class DependencyInjection
{
    public const string KafkaConnectionName = "kafka";

    /// <summary>
    /// Адаптеры projector: PostgreSQL (контекст, unit of work, репозитории), Kafka (consumer группы
    /// <paramref name="consumerGroup"/>, десериализатор, офсеты, трейсинг), health checks и метр.
    /// </summary>
    public static IHostApplicationBuilder AddProjectorInfrastructure(this IHostApplicationBuilder builder, string consumerGroup)
    {
        ArgumentNullException.ThrowIfNull(builder);
        ArgumentException.ThrowIfNullOrEmpty(consumerGroup);

        builder.Services.AddKafkaTracing();

        // Строка подключения "stats" приходит из AppHost; интеграция Aspire добавляет health check БД и OTel.
        // Retry-стратегия EF не допускает транзакций unit of work; батч и так повторяет цикл консьюмера с паузой.
        builder.AddNpgsqlDbContext<StatsDbContext>(
            StatsDbContext.ConnectionName,
            settings => settings.DisableRetry = true,
            options => options.UseNpgsql(StatsDbContext.ConfigureNpgsql));
        builder.Services.AddScoped<IUnitOfWork, EfUnitOfWork<StatsDbContext>>();
        builder.Services.AddScoped<IProcessedEventsRepository, ProcessedEventsRepository>();
        builder.Services.AddScoped<IStatsRepository, StatsRepository>();

        // Офсет коммитит цикл консьюмера после транзакции в БД (ADR-0002). Спаны process — своя обёртка из
        // BuildingBlocks (поверх них span links батча), поэтому трейсинг интеграции выключен; health check — свой.
        builder.AddKafkaConsumer<string, string>(KafkaConnectionName, settings =>
        {
            settings.DisableTracing = true;
            settings.DisableHealthChecks = true;
            KafkaDefaults.ApplyConsumerDefaults(settings.Config, consumerGroup);
        });
        builder.Services.AddSingleton<Func<ConsumeResult<string, string>, SiteEvent?>>(SiteEventDeserializer.Deserialize);

        var kafkaBootstrapServers = builder.Configuration.GetConnectionString(KafkaConnectionName) ?? string.Empty;
        builder.Services.AddSingleton<IConsumerOffsets>(new KafkaConsumerOffsets(kafkaBootstrapServers));
        builder.Services.AddSingleton(_ => new KafkaHealthCheck(kafkaBootstrapServers));
        builder.Services.AddHealthChecks().Add(new HealthCheckRegistration(
            KafkaConnectionName, sp => sp.GetRequiredService<KafkaHealthCheck>(), failureStatus: null, tags: null));

        builder.Services.AddOpenTelemetry().WithMetrics(metrics => metrics.AddMeter(ProjectorTelemetry.MeterName));
        return builder;
    }
}
