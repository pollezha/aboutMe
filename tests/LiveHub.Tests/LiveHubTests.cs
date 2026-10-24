using System.Diagnostics;
using System.Net;
using System.Text.Json;
using System.Threading.Channels;
using BuildingBlocks.Messaging.Kafka;
using Confluent.Kafka;
using Confluent.Kafka.Admin;
using Contracts;
using Contracts.Events;
using Contracts.Live;
using LiveHub.Application.Abstractions;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.Kafka;
using Xunit;

namespace LiveHub.Tests;

// Один брокер на класс; топик site.events.v1 создаёт фикстура (в проде — events-api/AppHost).
public sealed class LiveKafkaFixture : IAsyncLifetime
{
    private const string Image = "apache/kafka:4.1.1";
    private static readonly TimeSpan StartTimeout = TimeSpan.FromSeconds(90);

    // Создаётся в InitializeAsync: Build() уже обращается к Docker, а исключение из конструктора фикстуры
    // теряет понятное сообщение
    private KafkaContainer? _container;

    public string BootstrapServers =>
        (_container ?? throw new InvalidOperationException("Kafka is not started")).GetBootstrapAddress();

    public async ValueTask InitializeAsync()
    {
        using var cts = new CancellationTokenSource(StartTimeout);
        try
        {
            _container = new KafkaBuilder(Image).Build();
            await _container.StartAsync(cts.Token);
        }
        catch (Exception ex) when (ex is not OutOfMemoryException)
        {
            throw new InvalidOperationException(
                $"Kafka ({Image}) не запустилась за {StartTimeout.TotalSeconds:0} с. "
                + "Интеграционным тестам (Category=Integration) нужен запущенный Docker: проверьте `docker info`.",
                ex);
        }

        using var admin = new AdminClientBuilder(new AdminClientConfig { BootstrapServers = BootstrapServers }).Build();
        await admin.CreateTopicsAsync(
            [new TopicSpecification { Name = Topics.SiteEvents, NumPartitions = 3, ReplicationFactor = 1 }]);
    }

    public ValueTask DisposeAsync() => _container?.DisposeAsync() ?? ValueTask.CompletedTask;

    public async Task ProduceStopOpenedAsync(string stop, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var siteEvent = new SiteEvent(
            Guid.CreateVersion7(),
            EventTypes.StopOpened,
            now,
            now,
            $"session-{Guid.NewGuid():N}",
            Langs.En,
            Themes.Day,
            Devices.Desktop,
            JsonSerializer.SerializeToElement(new Dictionary<string, string> { ["stop"] = stop }));

        using var producer = new ProducerBuilder<string, string>(KafkaDefaults.CreateProducerConfig(BootstrapServers)).Build();
        await producer.ProduceAsync(
            Topics.SiteEvents,
            new Message<string, string>
            {
                Key = siteEvent.SessionHash,
                Value = JsonSerializer.Serialize(siteEvent, SiteEventJsonContext.Default.SiteEvent),
            },
            ct);
    }

    public LiveHubFactory CreateFactory() => new(BootstrapServers);
}

public sealed class LiveHubFactory(string bootstrapServers) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(Microsoft.AspNetCore.Hosting.IWebHostBuilder builder) =>
        builder.UseSetting("ConnectionStrings:kafka", bootstrapServers);

    public HubConnection CreateConnection() =>
        new HubConnectionBuilder()
            .WithUrl(new Uri(Server.BaseAddress, Api.Hubs.LiveHub.Path), options =>
            {
                // TestServer не поддерживает WebSocket через HttpMessageHandler — long polling
                options.Transports = HttpTransportType.LongPolling;
                options.HttpMessageHandlerFactory = _ => Server.CreateHandler();
            })
            .AddJsonProtocol(options =>
                options.PayloadSerializerOptions.TypeInfoResolverChain.Insert(0, LiveJsonContext.Default))
            .Build();
}

[Trait("Category", "Integration")]
public sealed class LiveHubTests(LiveKafkaFixture kafka) : IClassFixture<LiveKafkaFixture>
{
    private static readonly TimeSpan WarmUpTimeout = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan CountersDeadline = TimeSpan.FromSeconds(2);

    [Fact]
    public async Task Health_includes_kafka_and_alive_is_ok()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var factory = kafka.CreateFactory();
        using var client = factory.CreateClient();

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/alive", ct)).StatusCode);
        var health = await client.GetAsync("/health", ct);
        Assert.Equal(HttpStatusCode.OK, health.StatusCode);
    }

    [Fact]
    public async Task Client_gets_snapshot_on_connect_and_counters_within_two_seconds_after_an_event()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var factory = kafka.CreateFactory();
        await using var connection = factory.CreateConnection();

        var snapshot = new TaskCompletionSource<LiveSnapshot>(TaskCreationOptions.RunContinuationsAsynchronously);
        var counters = Channel.CreateUnbounded<LiveSnapshot>();
        connection.On<LiveSnapshot>(LiveHubMethods.Snapshot, s => snapshot.TrySetResult(s));
        connection.On<LiveSnapshot>(LiveHubMethods.Counters, s => counters.Writer.TryWrite(s));
        await connection.StartAsync(ct);

        var initial = await snapshot.Task.WaitAsync(WarmUpTimeout, ct);
        Assert.True(initial.EventsToday >= 0);

        // Прогрев: консьюмер вступил в группу и перемотал партиции
        var warmUp = UniqueStop();
        await kafka.ProduceStopOpenedAsync(warmUp, ct);
        await WaitForCountersAsync(counters.Reader, s => s.ByStop.GetValueOrDefault(warmUp) == 1, WarmUpTimeout, ct);

        var stop = UniqueStop();
        var watch = Stopwatch.StartNew();
        await kafka.ProduceStopOpenedAsync(stop, ct);
        var after = await WaitForCountersAsync(counters.Reader, s => s.ByStop.GetValueOrDefault(stop) == 1, WarmUpTimeout, ct);
        watch.Stop();

        Assert.True(watch.Elapsed <= CountersDeadline, $"counters пришли через {watch.Elapsed.TotalMilliseconds:0} мс");
        Assert.True(after.EventsToday >= 2);
        Assert.True(after.ByType[EventTypes.StopOpened] >= 2);
    }

    [Fact]
    public async Task Restarted_service_restores_today_counters_from_the_log()
    {
        var ct = TestContext.Current.CancellationToken;
        var stop = UniqueStop();
        const int Count = 3;

        LiveSnapshot before;
        await using (var first = kafka.CreateFactory())
        {
            _ = first.Server;
            for (var i = 0; i < Count; i++)
            {
                await kafka.ProduceStopOpenedAsync(stop, ct);
            }

            var firstState = first.Services.GetRequiredService<ILiveStateRepository>();
            before = await WaitForStateAsync(firstState, s => s.ByStop.GetValueOrDefault(stop) == Count, ct);
        }

        await using var second = kafka.CreateFactory();
        _ = second.Server;
        var secondState = second.Services.GetRequiredService<ILiveStateRepository>();
        var restored = await WaitForStateAsync(
            secondState, s => s.ByStop.GetValueOrDefault(stop) == Count && s.EventsToday == before.EventsToday, ct);

        Assert.Equal(before.EventsToday, restored.EventsToday);
        Assert.Equal(Count, restored.ByStop[stop]);
    }

    private static string UniqueStop() => $"t{Guid.NewGuid():N}"[..16];

    private static async Task<LiveSnapshot> WaitForCountersAsync(
        ChannelReader<LiveSnapshot> reader, Func<LiveSnapshot, bool> condition, TimeSpan timeout, CancellationToken ct)
    {
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(timeout);
        await foreach (var snapshot in reader.ReadAllAsync(cts.Token))
        {
            if (condition(snapshot))
            {
                return snapshot;
            }
        }

        throw new InvalidOperationException("counters channel completed");
    }

    private static async Task<LiveSnapshot> WaitForStateAsync(
        ILiveStateRepository state, Func<LiveSnapshot, bool> condition, CancellationToken ct)
    {
        var deadline = Stopwatch.StartNew();
        while (true)
        {
            var snapshot = state.GetSnapshot();
            if (condition(snapshot))
            {
                return snapshot;
            }

            Assert.True(
                deadline.Elapsed < WarmUpTimeout,
                $"Счётчики не сошлись за {WarmUpTimeout.TotalSeconds:0} с: eventsToday={snapshot.EventsToday}");
            await Task.Delay(TimeSpan.FromMilliseconds(100), ct);
        }
    }
}
