using System.Diagnostics.Metrics;
using System.Security.Claims;
using LiveHub.Infrastructure.Realtime;
using LiveHub.Infrastructure.Telemetry;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace LiveHub.Tests.Infrastructure;

public sealed class ConnectionMetricsHubFilterTests : IDisposable
{
    private readonly ServiceProvider _services = new ServiceCollection().AddMetrics().BuildServiceProvider();
    private readonly LiveTelemetry _telemetry;
    private readonly MeterListener _listener = new();
    private long _connections;

    public ConnectionMetricsHubFilterTests()
    {
        _telemetry = new LiveTelemetry(_services.GetRequiredService<IMeterFactory>());
        _listener.InstrumentPublished = (instrument, listener) =>
        {
            if (instrument.Meter == _telemetry.Meter && instrument.Name == "signalr_connections")
            {
                listener.EnableMeasurementEvents(instrument);
            }
        };
        _listener.SetMeasurementEventCallback<long>((_, value, _, _) => Interlocked.Add(ref _connections, value));
        _listener.Start();
    }

    public void Dispose()
    {
        _listener.Dispose();
        _services.Dispose();
    }

    [Fact]
    public async Task Signalr_connections_follows_connects_and_disconnects()
    {
        var filter = new ConnectionMetricsHubFilter(_telemetry);
        var first = Context();
        var second = Context();

        await filter.OnConnectedAsync(first, _ => Task.CompletedTask);
        await filter.OnConnectedAsync(second, _ => Task.CompletedTask);
        Assert.Equal(2, Interlocked.Read(ref _connections));

        await filter.OnDisconnectedAsync(first, null, (_, _) => Task.CompletedTask);
        Assert.Equal(1, Interlocked.Read(ref _connections));
    }

    [Fact]
    public async Task Connection_rejected_by_the_hub_is_not_counted()
    {
        var filter = new ConnectionMetricsHubFilter(_telemetry);

        await Assert.ThrowsAsync<HubException>(() =>
            filter.OnConnectedAsync(Context(), _ => throw new HubException("rejected")));

        Assert.Equal(0, Interlocked.Read(ref _connections));
    }

    private HubLifetimeContext Context() => new(new StubCallerContext(), _services, new StubHub());

    private sealed class StubHub : Hub;

    private sealed class StubCallerContext : HubCallerContext
    {
        public override string ConnectionId { get; } = Guid.NewGuid().ToString("N");

        public override string? UserIdentifier => null;

        public override ClaimsPrincipal? User => null;

        public override IDictionary<object, object?> Items { get; } = new Dictionary<object, object?>();

        public override IFeatureCollection Features { get; } = new FeatureCollection();

        public override CancellationToken ConnectionAborted => CancellationToken.None;

        public override void Abort()
        {
        }
    }
}
