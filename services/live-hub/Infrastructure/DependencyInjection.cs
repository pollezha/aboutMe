using BuildingBlocks.Messaging.Kafka;
using Confluent.Kafka;
using Contracts;
using Contracts.Events;
using Contracts.Live;
using LiveHub.Application.Abstractions;
using LiveHub.Infrastructure.InMemory;
using LiveHub.Infrastructure.Messaging;
using LiveHub.Infrastructure.Realtime;
using LiveHub.Infrastructure.Telemetry;
using Microsoft.AspNetCore.SignalR;

namespace LiveHub.Infrastructure;

public static class DependencyInjection
{
    /// <summary>
    /// Adapters: Kafka consumer of <c>site.events.v1</c> (group live-hub, auto commit, rewind to the start of the
    /// UTC day on every assignment) with <see cref="KafkaConsumerLoop{TMessage}"/>, in-memory live state,
    /// SignalR with the contract JSON and <see cref="ILiveNotifier"/>, the live-hub meter.
    /// The loop takes <see cref="IKafkaMessageHandler{TMessage}"/> of <see cref="SiteEvent"/> from DI (Workers).
    /// </summary>
    public static TBuilder AddLiveHubInfrastructure<TBuilder>(this TBuilder builder)
        where TBuilder : IHostApplicationBuilder
    {
        ArgumentNullException.ThrowIfNull(builder);

        // Kafka из connection string "kafka" (AppHost); Aspire добавляет health check в /health и метрики клиента
        builder.AddKafkaConsumer<string, string>(
            "kafka",
            settings => KafkaDefaults.ApplyConsumerDefaults(
                settings.Config, ConsumerGroups.LiveHub, enableAutoCommit: true, AutoOffsetReset.Latest),
            (services, consumer) => consumer.SetPartitionsAssignedHandler(
                (c, partitions) => services.GetRequiredService<StartOfDayRewind>().Rewind(c, partitions)));
        builder.Services.AddKafkaTracing();
        builder.Services.AddSingleton<StartOfDayRewind>();
        builder.Services.AddSingleton(services => new KafkaConsumerLoop<SiteEvent>(
            services.GetRequiredService<IConsumer<string, string>>(),
            SiteEventDeserializer.Deserialize,
            services.GetRequiredService<IKafkaMessageHandler<SiteEvent>>(),
            new KafkaConsumerLoopOptions
            {
                Topic = Topics.SiteEvents,
                PoisonCounterName = LiveTelemetry.PoisonCounterName,
                // Счётчики должны прийти клиентам за 2 с: событие обрабатывается сразу, без добора батча
                MaxBatchSize = 1,
                // enable.auto.commit = true: офсеты коммитит клиент, после рестарта всё равно перемотка на начало суток
                CommitOffsets = false,
            },
            services.GetRequiredService<LiveTelemetry>().Meter,
            services.GetRequiredService<ILogger<KafkaConsumerLoop<SiteEvent>>>()));

        builder.Services.AddSingleton<LiveTelemetry>();
        builder.Services.AddOpenTelemetry().WithMetrics(metrics => metrics.AddMeter(LiveTelemetry.MeterName));

        builder.Services.AddSingleton<ILiveStateRepository, InMemoryLiveStateRepository>();

        builder.Services.AddSingleton<ConnectionMetricsHubFilter>();
        builder.Services.AddSignalR(options => options.AddFilter<ConnectionMetricsHubFilter>())
            .AddJsonProtocol(options =>
                options.PayloadSerializerOptions.TypeInfoResolverChain.Insert(0, LiveJsonContext.Default));
        builder.Services.AddSingleton<ILiveNotifier, SignalRLiveNotifier>();
        return builder;
    }
}
