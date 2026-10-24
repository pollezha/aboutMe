using LiveHub.Infrastructure.Telemetry;
using Microsoft.AspNetCore.SignalR;

namespace LiveHub.Infrastructure.Realtime;

// Метрика signalr_connections снаружи хаба: хаб (Api) не зависит от телеметрии (Infrastructure).
public sealed class ConnectionMetricsHubFilter(LiveTelemetry telemetry) : IHubFilter
{
    public async Task OnConnectedAsync(HubLifetimeContext context, Func<HubLifetimeContext, Task> next)
    {
        ArgumentNullException.ThrowIfNull(next);

        await next(context);
        telemetry.ConnectionOpened();
    }

    public Task OnDisconnectedAsync(
        HubLifetimeContext context, Exception? exception, Func<HubLifetimeContext, Exception?, Task> next)
    {
        ArgumentNullException.ThrowIfNull(next);

        telemetry.ConnectionClosed();
        return next(context, exception);
    }
}
