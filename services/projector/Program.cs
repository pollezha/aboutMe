using BuildingBlocks.Messaging.Kafka;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Projector.Data;
using Projector.Projection;

const string KafkaConnectionName = "kafka";

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
builder.Services.AddKafkaTracing();

// Строка подключения "stats" приходит из AppHost; интеграция Aspire добавляет health check БД и OTel
builder.AddNpgsqlDbContext<StatsDbContext>(
    StatsDbContext.ConnectionName,
    configureDbContextOptions: options => options.UseNpgsql(StatsDbContext.ConfigureNpgsql));

var projectorOptions = builder.Configuration.GetSection(ProjectorOptions.SectionName).Get<ProjectorOptions>()
    ?? new ProjectorOptions();
builder.Services.AddSingleton(projectorOptions);

// Consumer group projector: офсет коммитит воркер после транзакции в БД (ADR-0002). Спаны process — своя обёртка
// из BuildingBlocks (поверх них span links батча), поэтому трейсинг интеграции выключен; health check — свой.
builder.AddKafkaConsumer<string, string>(KafkaConnectionName, settings =>
{
    settings.DisableTracing = true;
    settings.DisableHealthChecks = true;
    KafkaDefaults.ApplyConsumerDefaults(settings.Config, projectorOptions.ConsumerGroup);
});
var kafkaBootstrapServers = builder.Configuration.GetConnectionString(KafkaConnectionName) ?? string.Empty;
builder.Services.AddSingleton(_ => new KafkaHealthCheck(kafkaBootstrapServers));
builder.Services.AddHealthChecks().Add(new HealthCheckRegistration(
    KafkaConnectionName, sp => sp.GetRequiredService<KafkaHealthCheck>(), failureStatus: null, tags: null));

builder.Services.AddSingleton<PoisonCounter>();
builder.Services.AddHostedService<ProjectorWorker>();
builder.Services.AddOpenTelemetry().WithMetrics(metrics => metrics.AddMeter(PoisonCounter.MeterName));

var app = builder.Build();

// `dotnet run --project services/projector -- migrate`: применить миграции и выйти (шаг деплоя)
if (args.Contains("migrate", StringComparer.Ordinal))
{
    return await StatsMigrations.ApplyAsync(app.Services, app.Logger, CancellationToken.None);
}

// `dotnet run --project services/projector -- rebuild`: пересчёт агрегатов из журнала; projector должен быть остановлен
if (args.Contains("rebuild", StringComparer.Ordinal))
{
    return await StatsRebuild.RunAsync(
        app.Services, kafkaBootstrapServers, projectorOptions.ConsumerGroup, app.Logger, CancellationToken.None);
}

// Только для локального запуска из AppHost; в проде миграции — отдельный шаг деплоя
if (app.Configuration.GetValue<bool>("Database:MigrateOnStart"))
{
    var exitCode = await StatsMigrations.ApplyAsync(app.Services, app.Logger, CancellationToken.None);
    if (exitCode != 0)
    {
        return exitCode;
    }
}

app.MapDefaultEndpoints();

await app.RunAsync();
return 0;
