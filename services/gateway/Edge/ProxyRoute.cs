using Yarp.ReverseProxy.Configuration;
using Yarp.ReverseProxy.Model;

namespace Gateway.Edge;

// Маршрут YARP выбранного эндпоинта — для политик, которые зависят от маршрута (после UseRouting)
internal static class ProxyRoute
{
    public static RouteConfig? Of(HttpContext context) =>
        context.GetEndpoint()?.Metadata.GetMetadata<RouteModel>()?.Config;
}
