using System.Diagnostics.Metrics;
using System.Threading.Channels;
using BuildingBlocks.Messaging.Kafka;
using Confluent.Kafka;
using Confluent.Kafka.Admin;
using Microsoft.Extensions.Diagnostics.Metrics.Testing;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace BuildingBlocks.Tests.Messaging.Kafka;

[Trait("Category", "Integration")]
public sealed class KafkaConsumerLoopTests(KafkaFixture kafka) : IClassFixture<KafkaFixture>, IDisposable
{
    private const string PoisonCounterName = "test_poison_total";
    private static readonly TimeSpan WaitTimeout = TimeSpan.FromSeconds(30);

    private readonly Meter _meter = new($"BuildingBlocks.Tests.{Guid.NewGuid():N}");
    private readonly string _topic = $"loop-{Guid.NewGuid():N}";
    private readonly string _group = $"loop-{Guid.NewGuid():N}";

    [Fact]
    public async Task Batch_is_cut_at_max_size()
    {
        var ct = TestContext.Current.CancellationToken;
        await CreateTopicAsync();
        await ProduceAsync(["1", "2", "3", "4", "5"]);
        var handler = new RecordingHandler();

        await using (Start(handler, new KafkaConsumerLoopOptions
        {
            Topic = _topic,
            PoisonCounterName = PoisonCounterName,
            MaxBatchSize = 2,
            BatchWindow = TimeSpan.FromSeconds(3),
        }))
        {
            Assert.Equal(["1", "2"], await handler.NextBatchAsync(ct));
            Assert.Equal(["3", "4"], await handler.NextBatchAsync(ct));
            Assert.Equal(["5"], await handler.NextBatchAsync(ct));
        }
    }

    [Fact]
    public async Task Batch_is_cut_by_time_window_after_the_first_message()
    {
        var ct = TestContext.Current.CancellationToken;
        await CreateTopicAsync();
        await ProduceAsync(["1", "2", "3"]);
        var handler = new RecordingHandler();

        await using (Start(handler, new KafkaConsumerLoopOptions
        {
            Topic = _topic,
            PoisonCounterName = PoisonCounterName,
            MaxBatchSize = 100,
            BatchWindow = TimeSpan.FromMilliseconds(500),
        }))
        {
            Assert.Equal(["1", "2", "3"], await handler.NextBatchAsync(ct));

            await ProduceAsync(["4"]);
            Assert.Equal(["4"], await handler.NextBatchAsync(ct));
        }
    }

    [Fact]
    public async Task Poison_message_is_counted_skipped_and_committed_without_stopping_the_loop()
    {
        var ct = TestContext.Current.CancellationToken;
        await CreateTopicAsync();
        await ProduceAsync(["poison", "1"]);
        var handler = new RecordingHandler();
        using var poison = new MetricCollector<long>(_meter, PoisonCounterName);

        await using (Start(handler, DefaultOptions()))
        {
            Assert.Equal(["1"], await handler.NextBatchAsync(ct));
            Assert.Equal(1, poison.GetMeasurementSnapshot().EvaluateAsCounter());

            await ProduceAsync(["2"]);
            Assert.Equal(["2"], await handler.NextBatchAsync(ct));
            await WaitForCommittedOffsetAsync(3);
        }
    }

    [Fact]
    public async Task Offset_is_committed_only_after_the_handler_succeeds()
    {
        var ct = TestContext.Current.CancellationToken;
        await CreateTopicAsync();
        await ProduceAsync(["1"]);
        var handler = new RecordingHandler { FailuresLeft = 1 };

        await using (Start(handler, DefaultOptions() with { FirstRetryDelay = TimeSpan.FromSeconds(2) }))
        {
            // Первая попытка упала: офсет на месте, пока идёт пауза перед повтором
            await handler.Failed.Task.WaitAsync(WaitTimeout, ct);
            Assert.Equal(Offset.Unset, await GetCommittedOffsetAsync());

            Assert.Equal(["1"], await handler.NextBatchAsync(ct));
            await WaitForCommittedOffsetAsync(1);
        }
    }

    [Fact]
    public async Task Without_manual_commit_the_loop_leaves_offsets_to_the_client()
    {
        var ct = TestContext.Current.CancellationToken;
        await CreateTopicAsync();
        await ProduceAsync(["1"]);
        var handler = new RecordingHandler();

        await using (Start(handler, DefaultOptions() with { CommitOffsets = false }, enableAutoCommit: false))
        {
            Assert.Equal(["1"], await handler.NextBatchAsync(ct));
            await Task.Delay(TimeSpan.FromSeconds(1), ct);
            Assert.Equal(Offset.Unset, await GetCommittedOffsetAsync());
        }
    }

    public void Dispose() => _meter.Dispose();

    private KafkaConsumerLoopOptions DefaultOptions() => new()
    {
        Topic = _topic,
        PoisonCounterName = PoisonCounterName,
        MaxBatchSize = 10,
        BatchWindow = TimeSpan.FromMilliseconds(200),
    };

    private RunningLoop Start(RecordingHandler handler, KafkaConsumerLoopOptions options, bool enableAutoCommit = false)
    {
        var consumer = new ConsumerBuilder<string, string>(
            KafkaDefaults.CreateConsumerConfig(kafka.BootstrapServers, _group, enableAutoCommit)).Build();
        var loop = new KafkaConsumerLoop<string>(
            consumer,
            result => result.Message.Value == "poison" ? null : result.Message.Value,
            handler,
            options,
            _meter,
            NullLogger.Instance);
        return new RunningLoop(consumer, loop);
    }

    private async Task CreateTopicAsync()
    {
        using var admin = new AdminClientBuilder(new AdminClientConfig { BootstrapServers = kafka.BootstrapServers }).Build();
        await admin.CreateTopicsAsync([new TopicSpecification { Name = _topic, NumPartitions = 1, ReplicationFactor = 1 }]);
    }

    private async Task ProduceAsync(IEnumerable<string> values)
    {
        using var producer = new ProducerBuilder<string, string>(
            KafkaDefaults.CreateProducerConfig(kafka.BootstrapServers)).Build();
        foreach (var value in values)
        {
            await producer.ProduceAsync(_topic, new Message<string, string> { Key = "k", Value = value });
        }
    }

    private async Task<Offset> GetCommittedOffsetAsync()
    {
        using var admin = new AdminClientBuilder(new AdminClientConfig { BootstrapServers = kafka.BootstrapServers }).Build();
        var groups = await admin.ListConsumerGroupOffsetsAsync(
            [new ConsumerGroupTopicPartitions(_group, [new TopicPartition(_topic, 0)])]);
        return groups[0].Partitions[0].Offset;
    }

    private async Task WaitForCommittedOffsetAsync(long expected)
    {
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(TestContext.Current.CancellationToken);
        cts.CancelAfter(WaitTimeout);
        while (await GetCommittedOffsetAsync() != expected)
        {
            await Task.Delay(TimeSpan.FromMilliseconds(100), cts.Token);
        }
    }

    private sealed class RecordingHandler : IKafkaMessageHandler<string>
    {
        private readonly Channel<IReadOnlyList<string>> _batches = Channel.CreateUnbounded<IReadOnlyList<string>>();

        public int FailuresLeft { get; set; }

        public TaskCompletionSource Failed { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);

        public Task HandleAsync(KafkaBatch<string> batch, CancellationToken cancellationToken)
        {
            if (FailuresLeft > 0)
            {
                FailuresLeft--;
                Failed.TrySetResult();
                throw new InvalidOperationException("handler failure");
            }

            _batches.Writer.TryWrite([.. batch.Messages]);
            return Task.CompletedTask;
        }

        public async Task<IReadOnlyList<string>> NextBatchAsync(CancellationToken ct) =>
            await _batches.Reader.ReadAsync(ct).AsTask().WaitAsync(WaitTimeout, ct);
    }

    /// <summary>Цикл в фоне; остановка — отмена токена и ожидание выхода (consumer закрывает сам цикл).</summary>
    private sealed class RunningLoop : IAsyncDisposable
    {
        private readonly IConsumer<string, string> _consumer;
        private readonly CancellationTokenSource _stop = new();
        private readonly Task _run;

        public RunningLoop(IConsumer<string, string> consumer, KafkaConsumerLoop<string> loop)
        {
            _consumer = consumer;
            _run = Task.Run(() => loop.RunAsync(_stop.Token));
        }

        public async ValueTask DisposeAsync()
        {
            await _stop.CancelAsync();
            await _run.WaitAsync(WaitTimeout);
            _consumer.Dispose();
            _stop.Dispose();
        }
    }
}
