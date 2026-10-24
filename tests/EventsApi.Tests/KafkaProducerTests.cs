using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using BuildingBlocks.Messaging.Kafka;
using Confluent.Kafka;
using Confluent.Kafka.Admin;
using Contracts;
using Contracts.Events;
using EventsApi.Infrastructure.Messaging;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace EventsApi.Tests;

// Топик создаётся заранее, как в проде (3 партиции): events-api при старте видит его и ничего не меняет.
public sealed class KafkaFixture : KafkaContainerFixture
{
    protected override async Task OnStartedAsync()
    {
        using var admin = new AdminClientBuilder(new AdminClientConfig { BootstrapServers = BootstrapServers }).Build();
        await admin.CreateTopicsAsync([new TopicSpecification { Name = Topics.SiteEvents, NumPartitions = 3, ReplicationFactor = 1 }]);
    }
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

// Настоящий продюсер без Docker: брокер по адресу, где никто не слушает. Ответ ограничен таймаутом доставки
// (KafkaDefaults.DeliveryTimeoutMs), а не повторами клиента.
public sealed class UnreachableKafkaProducerTests
{
    private static readonly TimeSpan Deadline = TimeSpan.FromSeconds(5);

    [Fact]
    public async Task Unreachable_broker_returns_503_within_five_seconds()
    {
        var ct = TestContext.Current.CancellationToken;
        using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("ConnectionStrings:kafka", "127.0.0.1:1");
            // Только создание топика при старте: оно ждало бы брокер; IEventPublisher остаётся настоящим
            builder.ConfigureTestServices(services =>
                services.Remove(services.Single(sd => sd.ImplementationType == typeof(TopicInitializer))));
        });
        using var client = factory.CreateClient();
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(Deadline * 2);
        using var content = new StringContent(
            new JsonObject
            {
                ["eventId"] = Guid.CreateVersion7().ToString(),
                ["type"] = EventTypes.CtaClick,
                ["occurredAt"] = DateTimeOffset.UtcNow.ToString("O"),
                ["sessionId"] = "session-42",
                ["lang"] = "en",
                ["theme"] = "day",
                ["payload"] = new JsonObject { ["cta"] = "telegram" },
            }.ToJsonString(),
            Encoding.UTF8,
            "application/json");

        var watch = Stopwatch.StartNew();
        var response = await client.PostAsync("/api/events", content, timeout.Token);
        watch.Stop();

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(ct);
        Assert.Equal("Event log unavailable", problem?.Title);
        Assert.True(watch.Elapsed <= Deadline, $"503 пришёл через {watch.Elapsed.TotalMilliseconds:0} мс");
    }
}
