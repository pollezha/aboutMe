using System.Text.Json;
using BuildingBlocks.Messaging.Kafka;
using Confluent.Kafka;
using Contracts;
using Contracts.Events;

namespace LiveHub.Live;

// Консьюмер site.events.v1 в группе live-hub (design §5.6): автокоммит, БД нет. Состояние после рестарта
// восстанавливается из журнала: при каждом назначении партиций RewindToStartOfDay перематывает их на начало
// текущих UTC-суток (OffsetsForTimes), повторы отсекает LiveState по eventId.
public sealed partial class LiveConsumerWorker(
    IConsumer<string, string> consumer,
    LiveState state,
    LiveBroadcaster broadcaster,
    LiveTelemetry telemetry,
    ILogger<LiveConsumerWorker> logger) : BackgroundService
{
    public static readonly TimeSpan TopicRetryInterval = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan MetadataTimeout = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan OffsetsForTimesTimeout = TimeSpan.FromSeconds(10);

    // Обработчик назначения партиций (SetPartitionsAssignedHandler): офсеты первых сообщений текущих суток.
    // Партиция без сегодняшних сообщений → Offset.End; ошибка запроса → Offset.Unset (коммит группы или latest).
    public static IEnumerable<TopicPartitionOffset> RewindToStartOfDay(
        IConsumer<string, string> consumer,
        IReadOnlyCollection<TopicPartition> partitions,
        TimeProvider time,
        ILogger logger)
    {
        ArgumentNullException.ThrowIfNull(consumer);
        ArgumentNullException.ThrowIfNull(partitions);
        ArgumentNullException.ThrowIfNull(time);

        var startOfDay = time.GetUtcNow().UtcDateTime.Date;
        var timestamp = new Timestamp(DateTime.SpecifyKind(startOfDay, DateTimeKind.Utc));
        try
        {
            var offsets = consumer.OffsetsForTimes(
                partitions.Select(p => new TopicPartitionTimestamp(p, timestamp)), OffsetsForTimesTimeout);
            LogRewound(logger, partitions.Count, startOfDay);
            return offsets.Select(o => new TopicPartitionOffset(o.TopicPartition, o.Offset));
        }
        catch (KafkaException ex)
        {
            LogRewindFailed(logger, ex);
            return partitions.Select(p => new TopicPartitionOffset(p, Offset.Unset));
        }
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken) =>
        Task.Run(() => Run(stoppingToken), stoppingToken);

    private async Task Run(CancellationToken stoppingToken)
    {
        try
        {
            await WaitForTopicAsync(stoppingToken);
            consumer.Subscribe(Topics.SiteEvents);

            while (!stoppingToken.IsCancellationRequested)
            {
                ConsumeResult<string, string>? result;
                try
                {
                    result = consumer.Consume(stoppingToken);
                }
                catch (ConsumeException ex)
                {
                    LogConsumeFailed(ex.Error.Code, ex);
                    continue;
                }

                if (result?.Message is not null)
                {
                    Handle(result);
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // штатная остановка
        }
        finally
        {
            // Коммит офсетов и выход из группы сразу, без ожидания session timeout (design §5.1)
            consumer.Close();
        }
    }

    private void Handle(ConsumeResult<string, string> result)
    {
        using var activity = KafkaTracePropagation.StartProcessActivity(result);

        SiteEvent? siteEvent;
        try
        {
            siteEvent = JsonSerializer.Deserialize(result.Message.Value, SiteEventJsonContext.Default.SiteEvent);
        }
        catch (JsonException)
        {
            siteEvent = null;
        }

        if (siteEvent is not { Type: not null, SessionHash: not null } || siteEvent.EventId == Guid.Empty)
        {
            telemetry.PoisonMessage();
            activity?.SetStatus(System.Diagnostics.ActivityStatusCode.Error, "poison message");
            LogPoison(result.Partition.Value, result.Offset.Value);
            return;
        }

        if (state.Apply(siteEvent))
        {
            broadcaster.MarkDirty();
        }
    }

    // Топик создаёт events-api/AppHost; пока его нет — ждём, предупреждение пишем один раз.
    private async Task WaitForTopicAsync(CancellationToken stoppingToken)
    {
        using var admin = new DependentAdminClientBuilder(consumer.Handle).Build();
        var warned = false;
        while (true)
        {
            try
            {
                // Метаданные всех топиков: запрос по имени мог бы создать топик автоматически
                var metadata = admin.GetMetadata(MetadataTimeout);
                if (metadata.Topics.Exists(t => t.Topic == Topics.SiteEvents && t.Error.Code == ErrorCode.NoError))
                {
                    LogTopicFound(Topics.SiteEvents);
                    return;
                }
            }
            catch (KafkaException ex)
            {
                LogMetadataFailed(ex.Error.Code);
            }

            if (!warned)
            {
                LogTopicMissing(Topics.SiteEvents, TopicRetryInterval.TotalSeconds);
                warned = true;
            }

            await Task.Delay(TopicRetryInterval, stoppingToken);
        }
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Rewound {PartitionCount} partitions to {StartOfDay:O}")]
    private static partial void LogRewound(ILogger logger, int partitionCount, DateTime startOfDay);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Rewind to the start of the day failed; reading from the committed offset")]
    private static partial void LogRewindFailed(ILogger logger, Exception exception);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Topic {Topic} not found yet; retrying every {RetrySeconds} s")]
    private partial void LogTopicMissing(string topic, double retrySeconds);

    [LoggerMessage(Level = LogLevel.Information, Message = "Topic {Topic} found, subscribing")]
    private partial void LogTopicFound(string topic);

    [LoggerMessage(Level = LogLevel.Debug, Message = "Kafka metadata request failed: {ErrorCode}")]
    private partial void LogMetadataFailed(ErrorCode errorCode);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Kafka consume failed: {ErrorCode}")]
    private partial void LogConsumeFailed(ErrorCode errorCode, Exception exception);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Poison message skipped at partition {Partition}, offset {Offset}")]
    private partial void LogPoison(int partition, long offset);
}
