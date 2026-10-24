using BuildingBlocks.Http;

namespace Gateway.Edge;

// Лимит тела берётся из MaxRequestBodySize маршрута. YARP сам ставит его в IHttpMaxRequestBodySizeFeature
// (это ловит chunked-тела при чтении); здесь — ранний отказ по Content-Length, до лимитера и бэкенда.
internal static class BodyLimits
{
    public static IApplicationBuilder UseBodyLimits(this IApplicationBuilder app) =>
        app.Use(async (context, next) =>
        {
            var limit = ProxyRoute.Of(context)?.MaxRequestBodySize;
            if (limit > 0 && context.Request.ContentLength > limit)
            {
                await HttpProblems.PayloadTooLarge((int)Math.Min(limit.Value, int.MaxValue)).ExecuteAsync(context);
                return;
            }

            await next(context);
        });
}
