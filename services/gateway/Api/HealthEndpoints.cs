using Gateway.Edge.Options;
using Microsoft.Extensions.Options;

namespace Gateway.Api;

internal static class HealthEndpoints
{
    private const string HealthPath = "/health";

    // /health — только для внутренней сети (smoke CD, алерты): с внешнего Host отвечаем пустым 404, как будто его нет.
    // Ставится до UseRouting, чтобы отказ не зависел от маршрутов.
    public static IApplicationBuilder UseInternalHealthHostFilter(this IApplicationBuilder app) =>
        app.Use((context, next) =>
        {
            if (context.Request.Path.StartsWithSegments(HealthPath, StringComparison.OrdinalIgnoreCase))
            {
                var allowedHosts = context.RequestServices.GetRequiredService<IOptions<HealthOptions>>().Value.AllowedHosts;
                if (!allowedHosts.Contains(context.Request.Host.Host, StringComparer.OrdinalIgnoreCase))
                {
                    context.Response.StatusCode = StatusCodes.Status404NotFound;
                    return Task.CompletedTask;
                }
            }

            return next(context);
        });

    // /health (сводный, с бэкендами) и /alive — из ServiceDefaults
    public static WebApplication MapHealthEndpoints(this WebApplication app) => app.MapDefaultEndpoints();
}
