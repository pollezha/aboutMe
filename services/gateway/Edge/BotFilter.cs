using Gateway.Edge.Options;
using Microsoft.Extensions.Options;

namespace Gateway.Edge;

// Известные боты не попадают в статистику: событие подтверждаем 204, но не проксируем (design §5.2)
internal static class BotFilter
{
    public const string EventsRouteId = "events";

    public static IServiceCollection AddGatewayBotFilter(this IServiceCollection services, IConfiguration configuration) =>
        services.Configure<BotsOptions>(configuration.GetSection(BotsOptions.SectionName));

    public static IApplicationBuilder UseBotFilter(this IApplicationBuilder app) =>
        app.Use((context, next) =>
        {
            if (ProxyRoute.Of(context)?.RouteId == EventsRouteId && IsBot(context))
            {
                context.Response.StatusCode = StatusCodes.Status204NoContent;
                return Task.CompletedTask;
            }

            return next(context);
        });

    private static bool IsBot(HttpContext context)
    {
        var userAgent = context.Request.Headers.UserAgent.ToString();
        if (userAgent.Length == 0)
        {
            return false;
        }

        var markers = context.RequestServices.GetRequiredService<IOptions<BotsOptions>>().Value.UserAgents;
        return markers.Exists(marker => userAgent.Contains(marker, StringComparison.OrdinalIgnoreCase));
    }
}
