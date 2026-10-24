using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;

namespace Gateway.Health;

internal sealed class GatewayHealthOptions
{
    public const string SectionName = "Health";

    // Хосты внутренней сети, с которых доступен сводный /health (без порта)
    public List<string> AllowedHosts { get; init; } = [];

    public TimeSpan Timeout { get; init; } = TimeSpan.FromSeconds(2);

    public TimeSpan CacheDuration { get; init; } = TimeSpan.FromSeconds(5);

    // Имя сервиса → URI его /health (имя хоста разрешает service discovery)
    public Dictionary<string, Uri> Backends { get; init; } = [];
}

internal static class GatewayHealth
{
    private const string HealthPath = "/health";

    // Сводный /health: self (из ServiceDefaults) + /health каждого бэкенда. Без тега "live" — /alive их не вызывает.
    // Список бэкендов читается при построении опций, а не при регистрации, — так его видят и переопределения в тестах.
    public static IServiceCollection AddBackendHealthChecks(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<GatewayHealthOptions>(configuration.GetSection(GatewayHealthOptions.SectionName));

        // Таймаут задаёт сама проверка, повторы не нужны: стандартный resilience-хендлер из ServiceDefaults
        // повторял бы 503 и растянул ответ /health. API помечен экспериментальным (EXTEXP0001) — других способов
        // снять хендлер с одного клиента при ConfigureHttpClientDefaults нет.
#pragma warning disable EXTEXP0001
        services.AddHttpClient(BackendHealthCheck.HttpClientName).RemoveAllResilienceHandlers();
#pragma warning restore EXTEXP0001

        // Проверки — синглтоны: кэш результата живёт между запросами /health
        services.AddSingleton<BackendHealthChecks>();
        services.AddOptions<HealthCheckServiceOptions>().Configure<IOptions<GatewayHealthOptions>>((options, health) =>
        {
            foreach (var name in health.Value.Backends.Keys)
            {
                options.Registrations.Add(new HealthCheckRegistration(
                    name, sp => sp.GetRequiredService<BackendHealthChecks>()[name], HealthStatus.Unhealthy, tags: ["backend"]));
            }
        });

        return services;
    }

    // /health — только для внутренней сети (smoke CD, алерты): с внешнего Host отвечаем 404, как будто его нет
    public static IApplicationBuilder UseInternalHealthEndpoint(this IApplicationBuilder app) =>
        app.Use((context, next) =>
        {
            if (context.Request.Path.StartsWithSegments(HealthPath, StringComparison.OrdinalIgnoreCase))
            {
                var allowedHosts = context.RequestServices.GetRequiredService<IOptions<GatewayHealthOptions>>().Value.AllowedHosts;
                if (!allowedHosts.Contains(context.Request.Host.Host, StringComparer.OrdinalIgnoreCase))
                {
                    context.Response.StatusCode = StatusCodes.Status404NotFound;
                    return Task.CompletedTask;
                }
            }

            return next(context);
        });
}

internal sealed class BackendHealthChecks(IHttpClientFactory httpClientFactory, IOptions<GatewayHealthOptions> options)
{
    private readonly Dictionary<string, BackendHealthCheck> checks = options.Value.Backends.ToDictionary(
        backend => backend.Key,
        backend => new BackendHealthCheck(
            httpClientFactory, backend.Value, options.Value.Timeout, options.Value.CacheDuration, TimeProvider.System));

    public BackendHealthCheck this[string name] => checks[name];
}
