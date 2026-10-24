using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Confluent.Kafka;
using Confluent.Kafka.Admin;
using Contracts;
using Contracts.Events;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using ServiceDefaults.Kafka;
using Testcontainers.Kafka;
using Xunit;

namespace EventsApi.Tests;

// Один контейнер Kafka (KRaft) на класс тестов; топик создаётся заранее, как в проде (3 партиции).
public sealed class KafkaFixture : IAsyncLifetime
{
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

        using var admin = new AdminClientBuilder(new AdminClientConfig { BootstrapServers = BootstrapServers }).Build();
        await admin.CreateTopicsAsync([new TopicSpecification { Name = Topics.SiteEvents, NumPartitions = 3, ReplicationFactor = 1 }]);
    }

    public ValueTask DisposeAsync() => _container.DisposeAsync();
}

[Trait("Category", "Integration")]
public sealed class KafkaProducerTests(KafkaFixture kafka) : IClassFixture<KafkaFixture>
{
    private static readonly TimeSpan ConsumeTimeout = TimeSpan.FromSeconds(30);

    [Fact]
    public async Task Accepted_event_reaches_kafka_keyed_by_session_hash_with_trace_headers()
    {
        var ct = TestContext.Current.CancellationToken;
        using var factory = CreateFactory();
        var eventId = Guid.CreateVersion7();
        var traceId = "4bf92f3577b34da6a3ce929d0e0e4736";
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/events")
        {
            Content = new StringContent(
                new JsonObject
                {
                    ["eventId"] = eventId.ToString(),
                    ["type"] = EventTypes.CtaClick,
                    ["occurredAt"] = DateTimeOffset.UtcNow.ToString("O"),
                    ["sessionId"] = "session-42",
                    ["lang"] = "ru",
                    ["theme"] = "night",
                    ["payload"] = new JsonObject { ["cta"] = "telegram" },
                }.ToJsonString(),
                Encoding.UTF8,
                "application/json"),
        };
        request.Headers.Add("traceparent", $"00-{traceId}-00f067aa0ba902b7-01");

        var response = await factory.CreateClient().SendAsync(request, ct);

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        var message = ConsumeEvent(eventId);
        var siteEvent = JsonSerializer.Deserialize(message.Value, SiteEventJsonContext.Default.SiteEvent);
        Assert.NotNull(siteEvent);
        Assert.Equal(siteEvent.SessionHash, message.Key);
        Assert.NotEqual("session-42", message.Key);
        Assert.Equal(KafkaHeaders.SchemaVersionValue, Header(message, KafkaHeaders.SchemaVersion));
        var traceParent = Header(message, KafkaHeaders.TraceParent);
        Assert.NotNull(traceParent);
        Assert.StartsWith($"00-{traceId}-", traceParent, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Health_is_200_when_kafka_is_reachable()
    {
        using var factory = CreateFactory();

        var response = await factory.CreateClient().GetAsync("/health", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Health_is_not_200_when_kafka_is_unreachable()
    {
        using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            builder.UseSetting("ConnectionStrings:kafka", "localhost:9"));

        var response = await factory.CreateClient().GetAsync("/health", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
    }

    private WebApplicationFactory<Program> CreateFactory() =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            builder.UseSetting("ConnectionStrings:kafka", kafka.BootstrapServers));

    private Message<string, string> ConsumeEvent(Guid eventId)
    {
        var config = KafkaDefaults.CreateConsumerConfig(kafka.BootstrapServers, groupId: $"test-{Guid.NewGuid():N}");
        using var consumer = new ConsumerBuilder<string, string>(config).Build();
        consumer.Subscribe(Topics.SiteEvents);
        try
        {
            var deadline = DateTime.UtcNow + ConsumeTimeout;
            while (DateTime.UtcNow < deadline)
            {
                var result = consumer.Consume(TimeSpan.FromSeconds(1));
                if (result?.Message.Value.Contains(eventId.ToString(), StringComparison.Ordinal) == true)
                {
                    return result.Message;
                }
            }

            Assert.Fail($"Событие {eventId} не пришло в {Topics.SiteEvents} за {ConsumeTimeout.TotalSeconds:0} с");
            return null!;
        }
        finally
        {
            consumer.Close();
        }
    }

    private static string? Header(Message<string, string> message, string key) =>
        message.Headers.TryGetLastBytes(key, out var bytes) ? Encoding.UTF8.GetString(bytes) : null;
}
