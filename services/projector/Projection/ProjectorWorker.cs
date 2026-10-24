using System.Diagnostics;
using System.Text.Json;
using Confluent.Kafka;
using Contracts.Events;
using Projector.Data;
using ServiceDefaults.Kafka;

namespace Projector.Projection;

/// <summary>
/// Consumer group <c>projector</c>: читает <c>site.events.v1</c> батчами, проецирует в <c>stats</c> одной транзакцией
/// и только после её коммита коммитит офсеты (design §5.5, §6). Ошибка БД не роняет сервис: батч повторяется с
/// растущей задержкой, офсет стоит на месте.
/// </summary>
public sealed partial class ProjectorWorker(
    IConsumer<string, string> consumer,
    IServiceScopeFactory scopeFactory,
    ProjectorOptions options,
    PoisonCounter poisonCounter,
    ILogger<ProjectorWorker> logger) : BackgroundService
{
    public const int MaxBatchSize = 200;

    /// <summary>Совпадает с <c>IHostEnvironment.ApplicationName</c> — его источник слушает OTel из ServiceDefaults.</summary>
    public static readonly string ActivitySourceName = typeof(ProjectorWorker).Assembly.GetName().Name!;

    private static readonly TimeSpan BatchWindow = TimeSpan.FromMilliseconds(500);
    private static readonly TimeSpan FirstRetryDelay = TimeSpan.FromSeconds(1);
    private static readonly TimeSpan MaxRetryDelay = TimeSpan.FromSeconds(30);
    private static readonly ActivitySource Source = new(ActivitySourceName);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Consume блокирует поток — уходим с потока старта хоста
        await Task.Yield();

        consumer.Subscribe(options.Topic);
        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                var batch = ConsumeBatch(out var consumeFailed);
                if (batch.Offsets.Count > 0)
                {
                    await ProjectWithRetryAsync(batch, stoppingToken);
                    CommitOffsets(batch);
                }
                else if (consumeFailed)
                {
                    await Task.Delay(FirstRetryDelay, stoppingToken);
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Остановка хоста: незакоммиченный батч будет прочитан заново — проекция идемпотентна
        }
        finally
        {
            CloseConsumer();
        }
    }

    /// <summary>Выход из группы: без него <c>rebuild</c> считал бы группу активной до истечения сессии.</summary>
    private void CloseConsumer()
    {
        try
        {
            consumer.Close();
        }
        catch (KafkaException ex)
        {
            LogCloseFailed(logger, ex.Error.Code, ex.Error.Reason);
        }
    }

    /// <summary>До <see cref="MaxBatchSize"/> сообщений или <see cref="BatchWindow"/> — что наступит раньше.</summary>
    private Batch ConsumeBatch(out bool consumeFailed)
    {
        consumeFailed = false;
        var batch = new Batch();
        var deadline = Stopwatch.GetTimestamp() + (long)(BatchWindow.TotalSeconds * Stopwatch.Frequency);
        while (batch.Offsets.Count < MaxBatchSize)
        {
            var remaining = Stopwatch.GetElapsedTime(Stopwatch.GetTimestamp(), deadline);
            if (remaining <= TimeSpan.Zero)
            {
                break;
            }

            ConsumeResult<string, string>? result;
            try
            {
                result = consumer.Consume(remaining);
            }
            catch (KafkaException ex)
            {
                // Нет топика, брокер недоступен и т. п.: librdkafka переподключается сам, повторим чуть позже
                LogConsumeFailed(logger, ex.Error.Code, ex.Error.Reason);
                consumeFailed = true;
                break;
            }

            if (result is null)
            {
                break;
            }

            if (result.IsPartitionEOF)
            {
                continue;
            }

            Accept(batch, result);
        }

        return batch;
    }

    /// <summary>Спан <c>process</c> на сообщение (продолжает трейс продюсера) и разбор события.</summary>
    private void Accept(Batch batch, ConsumeResult<string, string> result)
    {
        using (var activity = KafkaTracePropagation.StartProcessActivity(result))
        {
            if (activity is not null)
            {
                batch.Links.Add(new ActivityLink(activity.Context));
            }

            if (TryDeserialize(result.Message.Value) is { } siteEvent)
            {
                batch.Events.Add(siteEvent);
            }
            else
            {
                poisonCounter.Add();
                activity?.SetStatus(ActivityStatusCode.Error, "poison message");
                // Тело не логируем: в нём может оказаться что угодно
                LogPoison(logger, result.Topic, result.Partition.Value, result.Offset.Value);
            }
        }

        batch.Offsets[result.TopicPartition] = result.Offset + 1;
    }

    private static SiteEvent? TryDeserialize(string? value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return null;
        }

        try
        {
            var siteEvent = JsonSerializer.Deserialize(value, SiteEventJsonContext.Default.SiteEvent);
            return siteEvent is { Type: not null } && siteEvent.EventId != Guid.Empty ? siteEvent : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private async Task ProjectWithRetryAsync(Batch batch, CancellationToken stoppingToken)
    {
        if (batch.Events.Count == 0)
        {
            return;
        }

        var delay = FirstRetryDelay;
        for (var attempt = 1; ; attempt++)
        {
            using var activity = Source.StartActivity(
                "project batch", ActivityKind.Internal, parentContext: default, links: batch.Links);
            activity?.SetTag("messaging.batch.message_count", batch.Events.Count);
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<StatsDbContext>();
                var fresh = await StatsWriter.WriteAsync(db, batch.Events, stoppingToken);
                activity?.SetTag("projector.events.new", fresh);
                return;
            }
#pragma warning disable CA1031 // любая ошибка БД: откат уже случился, офсет не коммитим, повторяем батч
            catch (Exception ex) when (ex is not OperationCanceledException || !stoppingToken.IsCancellationRequested)
#pragma warning restore CA1031
            {
                activity?.SetStatus(ActivityStatusCode.Error, ex.GetType().Name);
                LogProjectFailed(logger, ex, batch.Events.Count, attempt, delay.TotalSeconds);
            }

            await Task.Delay(delay, stoppingToken);
            delay = TimeSpan.FromTicks(Math.Min(delay.Ticks * 2, MaxRetryDelay.Ticks));
        }
    }

    private void CommitOffsets(Batch batch)
    {
        try
        {
            consumer.Commit(batch.Offsets.Select(o => new TopicPartitionOffset(o.Key, o.Value)));
        }
        catch (KafkaException ex)
        {
            // Например, ребалансировка: батч придёт ещё раз, processed_events отсечёт повтор
            LogCommitFailed(logger, ex.Error.Code, ex.Error.Reason);
        }
    }

    private sealed class Batch
    {
        public List<SiteEvent> Events { get; } = [];

        public List<ActivityLink> Links { get; } = [];

        /// <summary>Следующий офсет к коммиту по каждой партиции (включая ядовитые сообщения).</summary>
        public Dictionary<TopicPartition, Offset> Offsets { get; } = [];
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Poison message skipped: {Topic} [{Partition}] @{Offset}")]
    private static partial void LogPoison(ILogger logger, string topic, int partition, long offset);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Kafka consume failed: {ErrorCode} {Reason}")]
    private static partial void LogConsumeFailed(ILogger logger, ErrorCode errorCode, string reason);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Kafka offset commit failed: {ErrorCode} {Reason}")]
    private static partial void LogCommitFailed(ILogger logger, ErrorCode errorCode, string reason);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Kafka consumer close failed: {ErrorCode} {Reason}")]
    private static partial void LogCloseFailed(ILogger logger, ErrorCode errorCode, string reason);

    [LoggerMessage(Level = LogLevel.Error,
        Message = "Projection of {Count} events failed (attempt {Attempt}), retrying in {DelaySeconds} s")]
    private static partial void LogProjectFailed(ILogger logger, Exception exception, int count, int attempt, double delaySeconds);
}
