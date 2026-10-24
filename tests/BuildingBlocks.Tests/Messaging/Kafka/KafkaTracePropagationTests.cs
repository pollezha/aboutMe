using System.Diagnostics;
using BuildingBlocks.Messaging.Kafka;
using Confluent.Kafka;
using Confluent.Kafka.Admin;
using OpenTelemetry;
using OpenTelemetry.Trace;
using Testcontainers.Kafka;
using Xunit;

namespace BuildingBlocks.Tests.Messaging.Kafka;

// Один контейнер Kafka (KRaft) на класс тестов; каждый тест — свой топик и своя consumer group.
public sealed class KafkaFixture : IAsyncLifetime
{
    // apache/kafka стартует в KRaft без ZooKeeper; версия зафиксирована (docs/learnings.md, этап 4, T0)
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
                $"Kafka ({Image}) не запустилась за {StartTimeout.TotalSeconds:0} с. "
                + "Интеграционным тестам (Category=Integration) нужен запущенный Docker: проверьте `docker info`.",
                ex);
        }
    }

    public ValueTask DisposeAsync() => _container.DisposeAsync();
}

[Trait("Category", "Integration")]
[Collection(ActivityListenersGroup.Name)]
public sealed class KafkaTracePropagationTests(KafkaFixture kafka) : IClassFixture<KafkaFixture>, IDisposable
{
    private static readonly TimeSpan ConsumeTimeout = TimeSpan.FromSeconds(30);

    private readonly ActivitySource _testSource = new("BuildingBlocks.Tests");

    // TracerProvider нужен дважды: он слушает (сэмплирует) ActivitySource и ставит
    // Propagators.DefaultTextMapPropagator = TraceContext + Baggage (без SDK там no-op).
    private readonly TracerProvider _tracerProvider = Sdk.CreateTracerProviderBuilder()
        .AddSource("BuildingBlocks.Tests", KafkaTracePropagation.ActivitySourceName)
        .Build();

    [Fact]
    public async Task Consume_span_continues_trace_of_the_producer()
    {
        var ct = TestContext.Current.CancellationToken;
        var topic = await CreateTopicAsync();

        ActivityTraceId requestTraceId;
        ActivitySpanId produceSpanId;
        using (var request = _testSource.StartActivity("request A"))
        {
            Assert.NotNull(request);
            requestTraceId = request.TraceId;

            using var produce = KafkaTracePropagation.StartProduceActivity(topic);
            Assert.NotNull(produce);
            produceSpanId = produce.SpanId;

            var headers = new Headers();
            KafkaTracePropagation.InjectTraceContext(headers, produce.Context);
            using var producer = new ProducerBuilder<string, string>(
                KafkaDefaults.CreateProducerConfig(kafka.BootstrapServers)).Build();
            await producer.ProduceAsync(topic, new Message<string, string> { Key = "k", Value = "v", Headers = headers }, ct);
        }

        Assert.Null(Activity.Current);
        var result = Consume(topic);
        using var process = KafkaTracePropagation.StartProcessActivity(result);

        Assert.NotNull(process);
        Assert.Equal(requestTraceId, process.TraceId);
        Assert.Equal(produceSpanId, process.ParentSpanId);
        Assert.Equal(ActivityKind.Consumer, process.Kind);
        Assert.Equal($"process {topic}", process.DisplayName);
        Assert.Equal("kafka", process.GetTagItem("messaging.system"));
        Assert.Equal(topic, process.GetTagItem("messaging.destination.name"));
        Assert.Equal("process", process.GetTagItem("messaging.operation"));
    }

    [Fact]
    public async Task Message_without_trace_headers_starts_a_new_root_trace()
    {
        var ct = TestContext.Current.CancellationToken;
        var topic = await CreateTopicAsync();
        using (var producer = new ProducerBuilder<string, string>(
            KafkaDefaults.CreateProducerConfig(kafka.BootstrapServers)).Build())
        {
            await producer.ProduceAsync(topic, new Message<string, string> { Key = "k", Value = "v" }, ct);
        }

        var result = Consume(topic);
        using var process = KafkaTracePropagation.StartProcessActivity(result);

        Assert.NotNull(process);
        Assert.Null(process.Parent);
        Assert.Equal(default, process.ParentSpanId);
        Assert.NotEqual(default, process.TraceId);
    }

    public void Dispose()
    {
        _tracerProvider.Dispose();
        _testSource.Dispose();
    }

    private async Task<string> CreateTopicAsync()
    {
        var topic = $"test.{Guid.NewGuid():N}";
        using var admin = new AdminClientBuilder(new AdminClientConfig { BootstrapServers = kafka.BootstrapServers }).Build();
        await admin.CreateTopicsAsync([new TopicSpecification { Name = topic, NumPartitions = 1, ReplicationFactor = 1 }]);
        return topic;
    }

    private ConsumeResult<string, string> Consume(string topic)
    {
        var config = KafkaDefaults.CreateConsumerConfig(kafka.BootstrapServers, groupId: $"test-{Guid.NewGuid():N}");
        using var consumer = new ConsumerBuilder<string, string>(config).Build();
        consumer.Subscribe(topic);
        try
        {
            var result = consumer.Consume(ConsumeTimeout);
            Assert.True(result is not null, $"Сообщение из {topic} не пришло за {ConsumeTimeout.TotalSeconds:0} с");
            return result;
        }
        finally
        {
            consumer.Close();
        }
    }
}
