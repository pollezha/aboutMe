using System.Collections.Concurrent;
using System.Diagnostics;
using System.Diagnostics.Metrics;
using System.Net;
using System.Text;
using System.Text.Json;
using BuildingBlocks.Messaging.Kafka;
using BuildingBlocks.Persistence;
using Confluent.Kafka;
using Confluent.Kafka.Admin;
using Contracts;
using Contracts.Events;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Projector.Application;
using Projector.Application.RebuildStats;
using Projector.Infrastructure.Messaging;
using Projector.Infrastructure.Persistence;
using Xunit;

namespace Projector.Tests;

[Trait("Category", "Integration")]
public sealed class ProjectorWorkerTests(PostgresFixture postgres, KafkaFixture kafka)
    : IClassFixture<PostgresFixture>, IClassFixture<KafkaFixture>
{
    private static readonly TimeSpan WaitTimeout = TimeSpan.FromSeconds(45);
    private static readonly DateTimeOffset Noon = new(2026, 10, 20, 12, 0, 0, TimeSpan.Zero);

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Host_is_healthy_without_incoming_events()
    {
        var env = await PrepareAsync();
        await using var host = StartHost(env);
        var client = host.CreateClient();

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health", Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/alive", Ct)).StatusCode);
    }

    [Fact]
    public async Task Redelivered_event_is_projected_once()
    {
        var env = await PrepareAsync();
        var click = Event(EventTypes.CtaClick, """{"cta":"contact"}""");
        await using var host = StartHost(env);

        await ProduceAsync(env, click, click);
        await WaitUntilAsync(env, "SELECT coalesce(sum(n), 0) FROM stats.cta_clicks", 1);
        // Повтор в следующем батче: отсекает уже не свёртка батча, а processed_events
        await ProduceAsync(env, click, Event(EventTypes.StopOpened, """{"stop":"profile"}"""));
        await WaitUntilAsync(env, "SELECT coalesce(sum(n), 0) FROM stats.stop_opens", 1);

        Assert.Equal(1, await ScalarAsync(env, "SELECT n FROM stats.cta_clicks WHERE cta = 'contact' AND source = 'unknown'"));
        Assert.Equal(1, await ScalarAsync(env, $"SELECT count(*) FROM stats.processed_events WHERE event_id = '{click.EventId}'"));
        Assert.Equal(2, await ScalarAsync(env, "SELECT count(*) FROM stats.processed_events"));
    }

    [Fact]
    public async Task Poison_message_is_counted_and_skipped()
    {
        var env = await PrepareAsync();
        var poison = new ConcurrentBag<(object? Scope, long Value)>();
        using var listener = ListenToPoisonCounter(poison);
        await using var host = StartHost(env);
        var meterFactory = host.Services.GetRequiredService<IMeterFactory>();

        await ProduceRawAsync(env, "not json");
        await ProduceAsync(env, Event(EventTypes.StopOpened, """{"stop":"profile"}"""));
        await WaitUntilAsync(env, "SELECT coalesce(sum(n), 0) FROM stats.stop_opens", 1);

        Assert.Equal(1, poison.Where(m => ReferenceEquals(m.Scope, meterFactory)).Sum(m => m.Value));
        Assert.Equal(1, await ScalarAsync(env, "SELECT count(*) FROM stats.processed_events"));
    }

    // Записано в журнал мимо events-api: PostgreSQL отвергает NUL в text (22021) — повтор не поможет
    [Fact]
    public async Task Event_rejected_by_the_database_is_skipped_as_poison()
    {
        var env = await PrepareAsync();
        var poison = new ConcurrentBag<(object? Scope, long Value)>();
        using var listener = ListenToPoisonCounter(poison);
        await using var host = StartHost(env);
        var meterFactory = host.Services.GetRequiredService<IMeterFactory>();
        long PoisonCount() => poison.Where(m => ReferenceEquals(m.Scope, meterFactory)).Sum(m => m.Value);

        await ProduceAsync(env, Event(EventTypes.StopOpened, """{"stop":"a\u0000"}"""));
        await WaitForAsync(() => PoisonCount() == 1, "poison counter = 1");
        await ProduceAsync(env, Event(EventTypes.StopOpened, """{"stop":"profile"}"""));
        await WaitUntilAsync(env, "SELECT coalesce(sum(n), 0) FROM stats.stop_opens", 1);
        await WaitForAsync(async () => await CommittedOffsetAsync(env) == 2, "committed offset = 2");

        Assert.Equal(1, PoisonCount());
        Assert.Equal(1, await ScalarAsync(env, "SELECT count(*) FROM stats.processed_events"));
    }

    [Fact]
    public async Task Batch_span_links_to_the_trace_of_each_event()
    {
        var env = await PrepareAsync();
        var batches = new ConcurrentBag<Activity>();
        using var listener = ListenToBatchSpans(batches);
        var producerTrace = ActivityTraceId.CreateRandom();
        var headers = new Headers
        {
            { KafkaHeaders.TraceParent, Encoding.UTF8.GetBytes($"00-{producerTrace}-{ActivitySpanId.CreateRandom()}-01") },
        };
        await using var host = StartHost(env);

        await ProduceRawAsync(env, headers, JsonSerializer.Serialize(
            Event(EventTypes.StopOpened, """{"stop":"profile"}"""), SiteEventJsonContext.Default.SiteEvent));
        await WaitUntilAsync(env, "SELECT coalesce(sum(n), 0) FROM stats.stop_opens", 1);

        var batch = Assert.Single(batches, a => a.Links.Any(l => l.Context.TraceId == producerTrace));
        Assert.NotEqual(producerTrace, batch.TraceId);
    }

    [Fact]
    public async Task Database_failure_is_retried_until_it_recovers()
    {
        var env = await PrepareAsync(migrate: false);
        await using var host = StartHost(env);

        await ProduceAsync(env, Event(EventTypes.CtaClick, """{"cta":"cv"}"""));
        await Task.Delay(TimeSpan.FromSeconds(2), Ct);
        await MigrateAsync(env);

        await WaitUntilAsync(env, "SELECT coalesce(sum(n), 0) FROM stats.cta_clicks", 1);
    }

    [Fact]
    public async Task Rebuild_recomputes_the_same_aggregates_from_the_log()
    {
        var env = await PrepareAsync();
        SiteEvent[] events =
        [
            Event(EventTypes.Visit, """{"source":"hh"}"""),
            Event(EventTypes.StopOpened, """{"stop":"profile"}"""),
            Event(EventTypes.StopOpened, """{"stop":"profile"}"""),
            Event(EventTypes.SkillOpened, """{"skill":"kafka"}"""),
            Event(EventTypes.CtaClick, """{"cta":"telegram"}"""),
            Event(EventTypes.WebVital, """{"name":"LCP","value":1800}"""),
        ];
        await ProduceAsync(env, events);
        string before;
        await using (StartHost(env))
        {
            await WaitUntilAsync(env, "SELECT count(*) FROM stats.processed_events", events.Length);
            before = await SnapshotAsync(env);
        }

        Assert.Equal(RebuildStatsResult.Done, await RebuildAsync(env));

        Assert.Equal(0, await ScalarAsync(env, """
            SELECT (SELECT count(*) FROM stats.daily_visits) + (SELECT count(*) FROM stats.stop_opens)
                 + (SELECT count(*) FROM stats.cta_clicks) + (SELECT count(*) FROM stats.web_vitals)
                 + (SELECT count(*) FROM stats.processed_events)
            """));
        await using (StartHost(env))
        {
            await WaitUntilAsync(env, "SELECT count(*) FROM stats.processed_events", events.Length);
            Assert.Equal(before, await SnapshotAsync(env));
        }

        Assert.Contains("stop_opens|2026-10-20|profile|2", before, StringComparison.Ordinal);
        Assert.Contains("web_vitals|2026-10-20|LCP|3|1", before, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Rebuild_refuses_while_the_projector_is_running()
    {
        var env = await PrepareAsync();
        await using var host = StartHost(env);
        await ProduceAsync(env, Event(EventTypes.StopOpened, """{"stop":"profile"}"""));
        await WaitUntilAsync(env, "SELECT coalesce(sum(n), 0) FROM stats.stop_opens", 1);

        Assert.Equal(RebuildStatsResult.GroupActive, await RebuildAsync(env));

        Assert.Equal(1, await ScalarAsync(env, "SELECT count(*) FROM stats.processed_events"));
    }

    private sealed record TestEnv(string Database, string Topic, string Group);

    private async Task<TestEnv> PrepareAsync(bool migrate = true)
    {
        var env = new TestEnv(postgres.NewDatabase(), await kafka.CreateTopicAsync(), $"projector-{Guid.NewGuid():N}");
        if (migrate)
        {
            await MigrateAsync(env);
        }

        return env;
    }

    private static async Task MigrateAsync(TestEnv env)
    {
        await using var services = PostgresFixture.CreateServices(env.Database);
        Assert.Equal(0, await StatsMigrations.ApplyAsync(services, NullLogger.Instance, Ct));
    }

    private async Task<RebuildStatsResult> RebuildAsync(TestEnv env)
    {
        await using var services = PostgresFixture.CreateServices(env.Database);
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<StatsDbContext>();
        await using var unitOfWork = new EfUnitOfWork<StatsDbContext>(db);
        var handler = new RebuildStatsHandler(new KafkaConsumerOffsets(kafka.BootstrapServers), new StatsRepository(db), unitOfWork);
        return await handler.HandleAsync(new RebuildStatsCommand(env.Group), Ct);
    }

    private WebApplicationFactory<Program> StartHost(TestEnv env)
    {
        var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(b => b
            .UseSetting($"ConnectionStrings:{StatsDbContext.ConnectionName}", env.Database)
            .UseSetting("ConnectionStrings:kafka", kafka.BootstrapServers)
            .UseSetting("Projector:Topic", env.Topic)
            .UseSetting("Projector:ConsumerGroup", env.Group));
        // Обращение к Services поднимает хост вместе с фоновым воркером
        _ = factory.Services;
        return factory;
    }

    private Task ProduceAsync(TestEnv env, params SiteEvent[] events) =>
        ProduceRawAsync(env, [.. events.Select(e => JsonSerializer.Serialize(e, SiteEventJsonContext.Default.SiteEvent))]);

    private Task ProduceRawAsync(TestEnv env, params string[] values) => ProduceRawAsync(env, headers: null, values);

    private async Task ProduceRawAsync(TestEnv env, Headers? headers, params string[] values)
    {
        using var producer = new ProducerBuilder<string, string>(
            KafkaDefaults.CreateProducerConfig(kafka.BootstrapServers)).Build();
        foreach (var value in values)
        {
            await producer.ProduceAsync(env.Topic, new Message<string, string> { Key = "session", Value = value, Headers = headers }, Ct);
        }
    }

    private static async Task WaitUntilAsync(TestEnv env, string sql, long expected)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(Ct);
        timeout.CancelAfter(WaitTimeout);
        long actual = -1;
        while (!timeout.IsCancellationRequested)
        {
            actual = await TryScalarAsync(env, sql);
            if (actual == expected)
            {
                return;
            }

            await Task.Delay(200, Ct);
        }

        Assert.Fail($"`{sql}` = {actual}, expected {expected} within {WaitTimeout.TotalSeconds:0} s");
    }

    private static Task WaitForAsync(Func<bool> condition, string description) =>
        WaitForAsync(() => Task.FromResult(condition()), description);

    private static async Task WaitForAsync(Func<Task<bool>> condition, string description)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(Ct);
        timeout.CancelAfter(WaitTimeout);
        while (!timeout.IsCancellationRequested)
        {
            if (await condition())
            {
                return;
            }

            await Task.Delay(200, Ct);
        }

        Assert.Fail($"Expected {description} within {WaitTimeout.TotalSeconds:0} s");
    }

    private async Task<long> CommittedOffsetAsync(TestEnv env)
    {
        using var admin = new AdminClientBuilder(new AdminClientConfig { BootstrapServers = kafka.BootstrapServers }).Build();
        var groups = await admin.ListConsumerGroupOffsetsAsync(
            [new ConsumerGroupTopicPartitions(env.Group, [new TopicPartition(env.Topic, 0)])]);
        return groups[0].Partitions[0].Offset.Value;
    }

    private static async Task<long> TryScalarAsync(TestEnv env, string sql)
    {
        try
        {
            return await ScalarAsync(env, sql);
        }
        catch (Exception ex) when (ex is NpgsqlException)
        {
            return -1;
        }
    }

    private static async Task<long> ScalarAsync(TestEnv env, string sql)
    {
        await using var connection = new NpgsqlConnection(env.Database);
        await connection.OpenAsync(Ct);
        await using var command = new NpgsqlCommand(sql, connection);
        return Convert.ToInt64(await command.ExecuteScalarAsync(Ct), System.Globalization.CultureInfo.InvariantCulture);
    }

    /// <summary>Все строки агрегатов одной строкой в стабильном порядке.</summary>
    private static async Task<string> SnapshotAsync(TestEnv env)
    {
        const string sql = """
            SELECT 'daily_visits|' || day || '|' || source || '|' || device || '|' || visits FROM stats.daily_visits
            UNION ALL SELECT 'stop_opens|' || day || '|' || stop || '|' || n FROM stats.stop_opens
            UNION ALL SELECT 'cta_clicks|' || day || '|' || cta || '|' || source || '|' || n FROM stats.cta_clicks
            UNION ALL SELECT 'web_vitals|' || day || '|' || name || '|' || bucket || '|' || n FROM stats.web_vitals
            ORDER BY 1
            """;
        await using var connection = new NpgsqlConnection(env.Database);
        await connection.OpenAsync(Ct);
        await using var command = new NpgsqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(Ct);
        var rows = new List<string>();
        while (await reader.ReadAsync(Ct))
        {
            rows.Add(reader.GetString(0));
        }

        return string.Join('\n', rows);
    }

    private static ActivityListener ListenToBatchSpans(ConcurrentBag<Activity> batches)
    {
        var listener = new ActivityListener
        {
            ShouldListenTo = source => source.Name == ProjectorTelemetry.ActivitySourceName,
            Sample = (ref ActivityCreationOptions<ActivityContext> _) => ActivitySamplingResult.AllDataAndRecorded,
            ActivityStopped = activity =>
            {
                if (activity.OperationName == "project batch")
                {
                    batches.Add(activity);
                }
            },
        };
        ActivitySource.AddActivityListener(listener);
        return listener;
    }

    private static MeterListener ListenToPoisonCounter(ConcurrentBag<(object? Scope, long Value)> measurements)
    {
        var listener = new MeterListener
        {
            InstrumentPublished = (instrument, l) =>
            {
                if (instrument.Meter.Name == ProjectorTelemetry.MeterName && instrument.Name == ProjectorTelemetry.PoisonCounterName)
                {
                    l.EnableMeasurementEvents(instrument);
                }
            },
        };
        listener.SetMeasurementEventCallback<long>((instrument, value, _, _) => measurements.Add((instrument.Meter.Scope, value)));
        listener.Start();
        return listener;
    }

    private static SiteEvent Event(string type, string payload)
    {
        using var doc = JsonDocument.Parse(payload);
        return new SiteEvent(
            Guid.CreateVersion7(), type, Noon, Noon, "hash", Langs.En, Themes.Day, Devices.Desktop, doc.RootElement.Clone());
    }
}
