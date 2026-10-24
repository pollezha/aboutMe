using System.Diagnostics.Metrics;
using BuildingBlocks.Messaging.Kafka;
using Confluent.Kafka;
using Contracts.Events;
using Projector.Application;
using Projector.Application.ProjectEvents;

namespace Projector.Workers;

/// <summary>
/// Consumer group <c>projector</c>: читает <c>site.events.v1</c> батчами (до 200 сообщений или 500 мс) и проецирует
/// их в <c>stats</c>; офсеты цикл коммитит только после успешной транзакции (design §5.5, §6). Ошибка БД не роняет
/// сервис: батч повторяется с растущей задержкой, офсет стоит на месте.
/// </summary>
public sealed class ProjectorWorker(
    IConsumer<string, string> consumer,
    Func<ConsumeResult<string, string>, SiteEvent?> deserialize,
    IServiceScopeFactory scopeFactory,
    ProjectorOptions options,
    IMeterFactory meterFactory,
    ILogger<ProjectorWorker> logger) : BackgroundService
{
    public const int MaxBatchSize = 200;

    private static readonly TimeSpan BatchWindow = TimeSpan.FromMilliseconds(500);

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var loop = new KafkaConsumerLoop<SiteEvent>(
            consumer,
            deserialize,
            new ScopedProjectEvents(scopeFactory),
            new KafkaConsumerLoopOptions
            {
                Topic = options.Topic,
                PoisonCounterName = ProjectorTelemetry.PoisonCounterName,
                MaxBatchSize = MaxBatchSize,
                BatchWindow = BatchWindow,
                CommitOffsets = true,
            },
            meterFactory.Create(ProjectorTelemetry.MeterName),
            logger);

        // Consume блокирует поток — уходим с потока старта хоста
        return Task.Run(() => loop.RunAsync(stoppingToken), stoppingToken);
    }

    /// <summary>Батч → <see cref="ProjectEventsHandler"/> в своём scope: свой DbContext и unit of work на батч.</summary>
    private sealed class ScopedProjectEvents(IServiceScopeFactory scopeFactory) : IKafkaMessageHandler<SiteEvent>
    {
        public async Task HandleAsync(KafkaBatch<SiteEvent> batch, CancellationToken cancellationToken)
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var handler = scope.ServiceProvider.GetRequiredService<ProjectEventsHandler>();
            await handler.HandleAsync(new ProjectEventsCommand(batch.Messages, batch.Links), cancellationToken);
        }
    }
}
