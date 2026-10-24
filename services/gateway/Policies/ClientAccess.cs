using System.Net;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.AspNetCore.HttpOverrides;

namespace Gateway.Policies;

// Кто клиент и откуда он может звать API: ForwardedHeaders и CORS (design §5.2).
// Конфиг читается при построении опций, а не при регистрации, — так его видят и переопределения в тестах.
internal static class ClientAccess
{
    // X-Forwarded-* принимаются только от адресов из конфига (контейнер Caddy) и только на один хоп.
    // Пустой список — не доверять никому: лимиты считаются по адресу TCP-соединения.
    public static IServiceCollection AddGatewayForwardedHeaders(this IServiceCollection services)
    {
        services.AddOptions<ForwardedHeadersOptions>().Configure<IConfiguration>((options, configuration) =>
        {
            var knownProxies = configuration.GetSection("ForwardedHeaders:KnownProxies").Get<string[]>() ?? [];

            options.ForwardLimit = 1;
            options.KnownIPNetworks.Clear();
            options.KnownProxies.Clear();
            foreach (var proxy in knownProxies)
            {
                options.KnownProxies.Add(IPAddress.Parse(proxy));
            }

            // С пустыми KnownProxies и KnownIPNetworks middleware доверяет любому адресу — поэтому выключаем заголовки
            options.ForwardedHeaders = options.KnownProxies.Count > 0
                ? ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
                : ForwardedHeaders.None;
        });

        return services;
    }

    // Только домены сайта; методы GET/POST и заголовки Content-Type, traceparent. Чужой origin — без CORS-заголовков.
    public static IServiceCollection AddGatewayCors(this IServiceCollection services)
    {
        services.AddCors();
        services.AddOptions<CorsOptions>().Configure<IConfiguration>((options, configuration) =>
        {
            var origins = configuration.GetSection("Cors:Origins").Get<string[]>() ?? [];
            options.AddDefaultPolicy(policy => policy
                .WithOrigins(origins)
                .WithMethods(HttpMethods.Get, HttpMethods.Post)
                .WithHeaders("Content-Type", "traceparent"));
        });

        return services;
    }
}
