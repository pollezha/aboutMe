using BuildingBlocks.Messaging.Kafka;
using Confluent.Kafka;
using Contracts;
using Contracts.Events;

namespace LiveHub.Workers;

// Консьюмер site.events.v1 в группе live-hub (design §5.6): автокоммит, БД нет. Ждёт появления топика, затем
// отдаёт чтение общему KafkaConsumerLoop (обработчик — LiveEventsMessageHandler). Перемотку на начало суток при
// назначении партиций делает консьюмер, собранный в Infrastructure (StartOfDayRewind).
public sealed partial class LiveConsumerWorker(
    IConsumer<string, string> consumer,
    KafkaConsumerLoop<SiteEvent> loop,
    ILogger<LiveConsumerWorker> logger) : BackgroundService
{
    public static readonly TimeSpan TopicRetryInterval = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan MetadataTimeout = TimeSpan.FromSeconds(5);

    // Consume блокирует поток — цикл крутится в фоновом потоке
    protected override Task ExecuteAsync(CancellationToken stoppingToken) =>
        Task.Run(() => RunAsync(stoppingToken), stoppingToken);

    private async Task RunAsync(CancellationToken stoppingToken)
    {
        try
        {
            await WaitForTopicAsync(stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            return;
        }

        await loop.RunAsync(stoppingToken);
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

    [LoggerMessage(Level = LogLevel.Warning, Message = "Topic {Topic} not found yet; retrying every {RetrySeconds} s")]
    private partial void LogTopicMissing(string topic, double retrySeconds);

    [LoggerMessage(Level = LogLevel.Information, Message = "Topic {Topic} found, subscribing")]
    private partial void LogTopicFound(string topic);

    [LoggerMessage(Level = LogLevel.Debug, Message = "Kafka metadata request failed: {ErrorCode}")]
    private partial void LogMetadataFailed(ErrorCode errorCode);
}
