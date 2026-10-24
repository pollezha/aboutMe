using System.Net;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Options;
using AspNetForwardedHeadersOptions = Microsoft.AspNetCore.Builder.ForwardedHeadersOptions;
using GatewayForwardedHeadersOptions = Gateway.Edge.Options.ForwardedHeadersOptions;

namespace Gateway.Edge;

// Кто клиент: X-Forwarded-* принимаются только от адресов из конфига (контейнер Caddy) и только на один хоп
// (design §5.2). Пустой список — не доверять никому: лимиты считаются по адресу TCP-соединения.
internal static class ForwardedHeadersSetup
{
    public static IServiceCollection AddGatewayForwardedHeaders(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<GatewayForwardedHeadersOptions>(configuration.GetSection(GatewayForwardedHeadersOptions.SectionName));
        services.AddOptions<AspNetForwardedHeadersOptions>().Configure<IOptions<GatewayForwardedHeadersOptions>>((options, gateway) =>
        {
            options.ForwardLimit = 1;
            options.KnownIPNetworks.Clear();
            options.KnownProxies.Clear();
            foreach (var proxy in gateway.Value.KnownProxies)
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
}
