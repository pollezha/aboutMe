using System.Diagnostics.Metrics;
using BuildingBlocks.Messaging.Kafka;
using Confluent.Kafka;
using Contracts.Events;
using Npgsql;
using Projector.Application;
using Projector.Application.ProjectEvents;

namespace Projector.Workers;

/// <summary>
/// Consumer group <c>projector</c>: читает <c>site.events.v1</c> батчами (до 200 сообщений или 500 мс) и проецирует
/// их в <c>stats</c>; офсеты цикл коммитит только после успешной транзакции (design §5.5, §6). Ошибка БД не роняет
/// сервис: транзиентная — батч повторяется с растущей задержкой, офсет стоит на месте; детерминированная
/// (<see cref="IsDeterministicDatabaseError"/>) — батч пропускается как ядовитый.
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
                IsPoison = IsDeterministicDatabaseError,
            },
            meterFactory.Create(ProjectorTelemetry.MeterName),
            logger);

        // Consume блокирует поток — уходим с потока старта хоста
        return Task.Run(() => loop.RunAsync(stoppingToken), stoppingToken);
    }

    /// <summary>
    /// Ошибка PostgreSQL, которая повторится на тех же данных: класс SQLSTATE 22 (data exception — например,
    /// NUL в text) или 23 (нарушение ограничения). Такой батч пропускается как ядовитый, иначе projector встал бы
    /// навсегда. Транзиентные классы — 08 (соединение), 40 (откат/deadlock), 53 (ресурсы), 57 (остановка сервера) —
    /// и любые другие ошибки ретраятся. EF Core может обернуть исключение, поэтому смотрим всю цепочку.
    /// </summary>
    public static bool IsDeterministicDatabaseError(Exception exception)
    {
        for (var current = exception; current is not null; current = current.InnerException)
        {
            if (current is PostgresException { SqlState: ['2', '2' or '3', ..] })
            {
                return true;
            }
        }

        return false;
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
