using Confluent.Kafka;
using Confluent.Kafka.Admin;
using Testcontainers.Kafka;
using Xunit;

namespace Projector.Tests;

/// <summary>Один контейнер Kafka (KRaft) на класс тестов; каждый тест — свой топик и своя consumer group.</summary>
public sealed class KafkaFixture : IAsyncLifetime
{
    // Тот же образ, что в ServiceDefaults.Tests (docs/learnings.md, этап 4, T0)
    private const string Image = "apache/kafka:4.1.1";
    private static readonly TimeSpan StartTimeout = TimeSpan.FromSeconds(90);

    private readonly KafkaContainer _container = new KafkaBuilder(Image).Build();

    public string BootstrapServers => _container.GetBootstrapAddress();

    public async ValueTask InitializeAsync()
    {
        using var cts = new CancellationTokenSource(StartTimeout);
        try
        {
            await _container.StartAsync(cts.Token);
        }
        catch (Exception ex) when (ex is not OutOfMemoryException)
        {
            throw new InvalidOperationException(
                $"Kafka ({Image}) did not start within {StartTimeout.TotalSeconds:0} s. Is Docker running?", ex);
        }
    }

    public ValueTask DisposeAsync() => _container.DisposeAsync();

    public async Task<string> CreateTopicAsync()
    {
        var topic = $"test.{Guid.NewGuid():N}";
        using var admin = new AdminClientBuilder(new AdminClientConfig { BootstrapServers = BootstrapServers }).Build();
        await admin.CreateTopicsAsync([new TopicSpecification { Name = topic, NumPartitions = 1, ReplicationFactor = 1 }]);
        return topic;
    }
}
