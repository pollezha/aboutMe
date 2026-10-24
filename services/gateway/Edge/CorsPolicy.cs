using Microsoft.Extensions.Options;
using AspNetCorsOptions = Microsoft.AspNetCore.Cors.Infrastructure.CorsOptions;
using GatewayCorsOptions = Gateway.Edge.Options.CorsOptions;

namespace Gateway.Edge;

// Откуда можно звать API (design §5.2): только домены сайта; методы GET/POST и заголовки Content-Type, traceparent.
// Чужой origin — без CORS-заголовков.
internal static class CorsPolicy
{
    public static IServiceCollection AddGatewayCors(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<GatewayCorsOptions>(configuration.GetSection(GatewayCorsOptions.SectionName));
        services.AddCors();
        services.AddOptions<AspNetCorsOptions>().Configure<IOptions<GatewayCorsOptions>>((options, gateway) =>
            options.AddDefaultPolicy(policy => policy
                .WithOrigins([.. gateway.Value.Origins])
                .WithMethods(HttpMethods.Get, HttpMethods.Post)
                .WithHeaders("Content-Type", "traceparent")));

        return services;
    }
}
