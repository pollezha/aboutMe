using Microsoft.Extensions.Options;
using Yarp.ReverseProxy.Model;

namespace Gateway.Policies;

internal sealed class BotFilterOptions
{
    public const string SectionName = "Bots";

    // Подстроки User-Agent (без учёта регистра)
    public List<string> UserAgents { get; init; } = [];
}

// Политики, которые зависят от маршрута YARP (метаданные RouteModel выбранного эндпоинта).
internal static class RoutePolicies
{
    public const string EventsRouteId = "events";

    // Известные боты не попадают в статистику: событие подтверждаем 204, но не проксируем (design §5.2)
    public static IApplicationBuilder UseBotEventFilter(this IApplicationBuilder app) =>
        app.Use((context, next) =>
        {
            if (RouteOf(context)?.RouteId == EventsRouteId && IsBot(context))
            {
                context.Response.StatusCode = StatusCodes.Status204NoContent;
                return Task.CompletedTask;
            }

            return next(context);
        });

    // Лимит тела берётся из MaxRequestBodySize маршрута. YARP сам ставит его в IHttpMaxRequestBodySizeFeature
    // (это ловит chunked-тела при чтении); здесь — ранний отказ по Content-Length, до лимитера и бэкенда.
    public static IApplicationBuilder UseRequestBodyLimit(this IApplicationBuilder app) =>
        app.Use(async (context, next) =>
        {
            var limit = RouteOf(context)?.MaxRequestBodySize;
            if (limit > 0 && context.Request.ContentLength > limit)
            {
                await Results.Problem(
                    statusCode: StatusCodes.Status413PayloadTooLarge,
                    title: "Request body too large").ExecuteAsync(context);
                return;
            }

            await next(context);
        });

    private static Yarp.ReverseProxy.Configuration.RouteConfig? RouteOf(HttpContext context) =>
        context.GetEndpoint()?.Metadata.GetMetadata<RouteModel>()?.Config;

    private static bool IsBot(HttpContext context)
    {
        var userAgent = context.Request.Headers.UserAgent.ToString();
        if (userAgent.Length == 0)
        {
            return false;
        }

        var markers = context.RequestServices.GetRequiredService<IOptions<BotFilterOptions>>().Value.UserAgents;
        return markers.Exists(marker => userAgent.Contains(marker, StringComparison.OrdinalIgnoreCase));
    }
}
