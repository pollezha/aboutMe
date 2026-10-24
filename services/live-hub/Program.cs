using Confluent.Kafka;
using Contracts;
using Contracts.Live;
using LiveHub.Live;
using Microsoft.Extensions.DependencyInjection.Extensions;
using ServiceDefaults.Kafka;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

builder.Services.AddOpenTelemetry().WithMetrics(metrics => metrics.AddMeter(LiveTelemetry.MeterName));

// Kafka из connection string "kafka" (AppHost); Aspire добавляет health check в /health и метрики клиента
builder.AddKafkaConsumer<string, string>(
    "kafka",
    settings => KafkaDefaults.ApplyConsumerDefaults(
        settings.Config, ConsumerGroups.LiveHub, enableAutoCommit: true, AutoOffsetReset.Latest),
    (services, consumer) => consumer.SetPartitionsAssignedHandler((c, partitions) =>
        LiveConsumerWorker.RewindToStartOfDay(
            c,
            partitions,
            services.GetRequiredService<TimeProvider>(),
            services.GetRequiredService<ILogger<LiveConsumerWorker>>())));

builder.Services.TryAddSingleton(TimeProvider.System);
builder.Services.AddSingleton<LiveState>();
builder.Services.AddSingleton<LiveTelemetry>();
builder.Services.AddSingleton<LiveBroadcaster>();
builder.Services.AddHostedService(services => services.GetRequiredService<LiveBroadcaster>());
builder.Services.AddHostedService<LiveConsumerWorker>();

builder.Services.AddSignalR()
    .AddJsonProtocol(options => options.PayloadSerializerOptions.TypeInfoResolverChain.Insert(0, LiveJsonContext.Default));

var app = builder.Build();

app.MapDefaultEndpoints();
app.MapHub<LiveHub.Hubs.LiveHub>(LiveHub.Hubs.LiveHub.Path);

app.Run();
