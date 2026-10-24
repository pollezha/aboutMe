using System.Diagnostics;
using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using System.Threading.Channels;
using Aspire.Hosting.ApplicationModel;
using Aspire.Hosting.Testing;
using Contracts.Live;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Xunit;

namespace Integration.Tests;

// Сквозной путь live-счётчиков: gateway → events-api → Kafka → live-hub → SignalR через gateway (AC9, TC-13),
// независимость live-hub от projector (NFR4) и лимит соединений с хабом на IP (design §5.2).
// Все соединения теста идут с 127.0.0.1 — у них одна партиция лимитера (3 соединения).
[Collection(AppGroup.Name)]
[Trait("Category", "Integration")]
public sealed class LiveEndToEndTests(AppFixture app, ITestOutputHelper output)
{
    private const string HubPath = "/hubs/live";
    private const string Projector = "projector";
    private const int HubConnectionsPerIp = 3;

    private static readonly TimeSpan SnapshotTimeout = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan CountersDeadline = TimeSpan.FromSeconds(2);
    private static readonly TimeSpan CatchUpTimeout = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan ResourceTimeout = TimeSpan.FromSeconds(60);
    private static readonly TimeSpan PermitReleaseTimeout = TimeSpan.FromSeconds(10);
    private static readonly TimeSpan PollInterval = TimeSpan.FromMilliseconds(250);

    [Fact]
    public async Task Client_gets_snapshot_on_connect_through_gateway()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var live = await LiveClient.ConnectAsync(HubUri(), ct);

        var snapshot = await live.Snapshot.WaitAsync(SnapshotTimeout, ct);

        Assert.True(snapshot.EventsToday >= 0);
    }

    [Fact]
    public async Task Stop_opened_through_gateway_reaches_counters_within_two_seconds()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var live = await LiveClient.ConnectAsync(HubUri(), ct);
        var latest = await live.Snapshot.WaitAsync(SnapshotTimeout, ct);

        for (var i = 1; i <= 3; i++)
        {
            var before = latest.ByStop.GetValueOrDefault("contact");
            var watch = Stopwatch.StartNew();
            await PostAcceptedAsync(StopOpened("contact"), ct);
            var accepted = watch.Elapsed;

            latest = await live.WaitForCountersAsync(s => s.ByStop.GetValueOrDefault("contact") > before, ct);
            watch.Stop();

            output.WriteLine(
                $"run {i}: 202 через {accepted.TotalMilliseconds:0} мс, counters через {watch.Elapsed.TotalMilliseconds:0} мс");
            Assert.Equal(before + 1, latest.ByStop["contact"]);
            Assert.True(
                watch.Elapsed <= CountersDeadline,
                $"run {i}: counters пришли через {watch.Elapsed.TotalMilliseconds:0} мс (лимит {CountersDeadline.TotalMilliseconds:0} мс)");
        }
    }

    [Fact]
    public async Task Live_hub_keeps_counting_while_projector_is_down_and_projector_catches_up_after_restart()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var live = await LiveClient.ConnectAsync(HubUri(), ct);
        var latest = await live.Snapshot.WaitAsync(SnapshotTimeout, ct);
        var opened = StopOpened("timepath");
        var day = Day(opened);
        var projectedBefore = await StopOpensAsync(day, "timepath", ct);

        await ExecuteAsync(Projector, KnownResourceCommands.StopCommand, ct);
        try
        {
            await app.App.ResourceNotifications.WaitForResourceAsync(Projector, KnownResourceStates.TerminalStates, ct)
                .WaitAsync(ResourceTimeout, ct);

            var before = latest.ByStop.GetValueOrDefault("timepath");
            var watch = Stopwatch.StartNew();
            await PostAcceptedAsync(opened, ct);
            latest = await live.WaitForCountersAsync(s => s.ByStop.GetValueOrDefault("timepath") > before, ct);
            watch.Stop();

            output.WriteLine($"projector остановлен: counters через {watch.Elapsed.TotalMilliseconds:0} мс");
            Assert.Equal(before + 1, latest.ByStop["timepath"]);
            Assert.True(
                watch.Elapsed <= CountersDeadline,
                $"counters пришли через {watch.Elapsed.TotalMilliseconds:0} мс при остановленном projector");
            Assert.Equal(projectedBefore, await StopOpensAsync(day, "timepath", ct));
        }
        finally
        {
            await ExecuteAsync(Projector, KnownResourceCommands.StartCommand, ct);
            await app.App.ResourceNotifications.WaitForResourceHealthyAsync(Projector, ct).WaitAsync(ResourceTimeout, ct);
        }

        var catchUp = Stopwatch.StartNew();
        var projected = await WaitForAsync(() => StopOpensAsync(day, "timepath", ct), n => n > projectedBefore, ct);
        output.WriteLine($"projector дочитал журнал через {catchUp.Elapsed.TotalMilliseconds:0} мс после Healthy");
        Assert.Equal(projectedBefore + 1, projected);
    }

    [Fact]
    public async Task Fourth_simultaneous_hub_connection_from_one_ip_is_rejected_with_429()
    {
        var ct = TestContext.Current.CancellationToken;
        var open = new List<LiveClient>();
        try
        {
            for (var i = 0; i < HubConnectionsPerIp; i++)
            {
                open.Add(await LiveClient.ConnectAsync(HubUri(), ct));
            }

            var rejected = await Assert.ThrowsAsync<HttpRequestException>(() => LiveClient.ConnectAsync(HubUri(), ct));

            Assert.Equal(HttpStatusCode.TooManyRequests, rejected.StatusCode);
        }
        finally
        {
            foreach (var client in open)
            {
                await client.DisposeAsync();
            }
        }

        // Шлюз отпускает разрешения, когда YARP закрывает проксируемое WebSocket-соединение, — не сразу после Dispose.
        // Ждём, чтобы следующие тесты коллекции не упёрлись в лимит.
        await WaitForFreeHubPermitsAsync(ct);
    }

    private Uri HubUri() => new(app.App.GetEndpoint("gateway", "http"), HubPath);

    private async Task ExecuteAsync(string resource, string command, CancellationToken ct)
    {
        var result = await app.App.ResourceCommands.ExecuteCommandAsync(resource, command, ct);
        Assert.True(result.Success, $"{command} {resource}: {result.Message}");
    }

    private async Task WaitForFreeHubPermitsAsync(CancellationToken ct)
    {
        var deadline = Stopwatch.StartNew();
        while (true)
        {
            var open = new List<LiveClient>();
            try
            {
                for (var i = 0; i < HubConnectionsPerIp; i++)
                {
                    open.Add(await LiveClient.ConnectAsync(HubUri(), ct));
                }

                return;
            }
            catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.TooManyRequests
                && deadline.Elapsed < PermitReleaseTimeout)
            {
                await Task.Delay(PollInterval, ct);
            }
            finally
            {
                foreach (var client in open)
                {
                    await client.DisposeAsync();
                }
            }
        }
    }

    private async Task PostAcceptedAsync(JsonObject siteEvent, CancellationToken ct)
    {
        using var response = await app.Gateway.PostAsJsonAsync("/api/events", siteEvent, ct);
        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
    }

    private async Task<long> StopOpensAsync(DateOnly day, string stop, CancellationToken ct)
    {
        await using var connection = new NpgsqlConnection(app.StatsConnectionString);
        await connection.OpenAsync(ct);
        await using var command = new NpgsqlCommand(
            "SELECT coalesce(sum(n), 0) FROM stats.stop_opens WHERE day = $1 AND stop = $2", connection);
        command.Parameters.Add(new NpgsqlParameter { Value = day });
        command.Parameters.Add(new NpgsqlParameter { Value = stop });
        return Convert.ToInt64(await command.ExecuteScalarAsync(ct), CultureInfo.InvariantCulture);
    }

    private static async Task<long> WaitForAsync(Func<Task<long>> read, Func<long, bool> done, CancellationToken ct)
    {
        var deadline = Stopwatch.StartNew();
        while (true)
        {
            var value = await read();
            if (done(value))
            {
                return value;
            }

            Assert.True(
                deadline.Elapsed < CatchUpTimeout,
                $"Событие не дошло до stats за {CatchUpTimeout.TotalSeconds:0} с (последнее значение {value}).");
            await Task.Delay(PollInterval, ct);
        }
    }

    private static DateOnly Day(JsonObject siteEvent) => DateOnly.FromDateTime(
        DateTimeOffset.Parse(siteEvent["occurredAt"]!.GetValue<string>(), CultureInfo.InvariantCulture).UtcDateTime);

    private static JsonObject StopOpened(string stop) => new()
    {
        ["eventId"] = Guid.CreateVersion7().ToString(),
        ["type"] = "stop_opened",
        ["occurredAt"] = DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture),
        ["sessionId"] = $"it-{Guid.NewGuid():N}",
        ["lang"] = "en",
        ["theme"] = "day",
        ["payload"] = new JsonObject { ["stop"] = stop },
    };

    // Клиент хаба: snapshot при подключении и поток counters
    private sealed class LiveClient : IAsyncDisposable
    {
        private readonly HubConnection _connection;
        private readonly TaskCompletionSource<LiveSnapshot> _snapshot =
            new(TaskCreationOptions.RunContinuationsAsynchronously);
        private readonly Channel<LiveSnapshot> _counters = Channel.CreateUnbounded<LiveSnapshot>();

        private LiveClient(Uri hub)
        {
            _connection = new HubConnectionBuilder()
                // Только WebSocket, как в браузере: без молчаливого отката на long polling проверяется проксирование
                // WebSocket через YARP. negotiate остаётся — на нём срабатывает лимит соединений
                .WithUrl(hub, HttpTransportType.WebSockets)
                .AddJsonProtocol(options =>
                    options.PayloadSerializerOptions.TypeInfoResolverChain.Insert(0, LiveJsonContext.Default))
                .Build();
            _connection.On<LiveSnapshot>(LiveHubMethods.Snapshot, s => _snapshot.TrySetResult(s));
            _connection.On<LiveSnapshot>(LiveHubMethods.Counters, s => _counters.Writer.TryWrite(s));
        }

        public Task<LiveSnapshot> Snapshot => _snapshot.Task;

        public static async Task<LiveClient> ConnectAsync(Uri hub, CancellationToken ct)
        {
            var client = new LiveClient(hub);
            try
            {
                await client._connection.StartAsync(ct);
                return client;
            }
            catch
            {
                await client.DisposeAsync();
                throw;
            }
        }

        public async Task<LiveSnapshot> WaitForCountersAsync(Func<LiveSnapshot, bool> condition, CancellationToken ct)
        {
            // Таймаут с запасом: сам лимит ≤ 2 с проверяет вызывающий по Stopwatch и пишет время в отчёт
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(CatchUpTimeout);
            await foreach (var snapshot in _counters.Reader.ReadAllAsync(cts.Token))
            {
                if (condition(snapshot))
                {
                    return snapshot;
                }
            }

            throw new InvalidOperationException("Поток counters закрыт.");
        }

        public ValueTask DisposeAsync() => _connection.DisposeAsync();
    }
}
