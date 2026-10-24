using System.Globalization;
using Confluent.Kafka;
using Confluent.Kafka.Admin;
using Contracts;

namespace EventsApi.Infrastructure.Messaging;

/// <summary>
/// Creates <see cref="Topics.SiteEvents"/> at startup if it does not exist (design §5.4: 3 partitions, RF 1,
/// retention 365 days), so the first produced event never auto-creates it with broker defaults. An existing
/// topic is left as is; any failure is logged as a warning and does not stop the service.
/// </summary>
public sealed partial class TopicInitializer(IProducer<string, string> producer, ILogger<TopicInitializer> logger)
    : IHostedService
{
    public const int Partitions = 3;
    public const short ReplicationFactor = 1;
    public static readonly TimeSpan Retention = TimeSpan.FromDays(365);

    // Брокер недоступен → не держим старт сервиса дольше этого
    private static readonly TimeSpan RequestTimeout = TimeSpan.FromSeconds(10);

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using var admin = new DependentAdminClientBuilder(producer.Handle).Build();
        var topic = new TopicSpecification
        {
            Name = Topics.SiteEvents,
            NumPartitions = Partitions,
            ReplicationFactor = ReplicationFactor,
            Configs = new Dictionary<string, string>
            {
                ["retention.ms"] = Retention.TotalMilliseconds.ToString("0", CultureInfo.InvariantCulture),
            },
        };

        try
        {
            await admin.CreateTopicsAsync(
                    [topic],
                    new CreateTopicsOptions { RequestTimeout = RequestTimeout, OperationTimeout = RequestTimeout })
                .WaitAsync(RequestTimeout + TimeSpan.FromSeconds(1), cancellationToken);
            LogTopicCreated(Topics.SiteEvents, Partitions);
        }
        catch (CreateTopicsException ex)
            when (ex.Results.TrueForAll(r => r.Error.Code is ErrorCode.TopicAlreadyExists or ErrorCode.NoError))
        {
            LogTopicExists(Topics.SiteEvents);
        }
        catch (Exception ex) when (ex is KafkaException or TimeoutException)
        {
            LogTopicCreationFailed(ex, Topics.SiteEvents);
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    [LoggerMessage(Level = LogLevel.Information, Message = "Kafka topic {Topic} created with {Partitions} partitions")]
    private partial void LogTopicCreated(string topic, int partitions);

    [LoggerMessage(Level = LogLevel.Debug, Message = "Kafka topic {Topic} already exists")]
    private partial void LogTopicExists(string topic);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Could not create Kafka topic {Topic}; continuing without it")]
    private partial void LogTopicCreationFailed(Exception exception, string topic);
}
