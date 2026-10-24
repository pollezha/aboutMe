using Gateway.Edge.Options;
using Gateway.Infrastructure.Health;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;

namespace Gateway.Infrastructure;

internal static class DependencyInjection
{
    // Сводный /health: self (из ServiceDefaults) + /health каждого бэкенда. Без тега "live" — /alive их не вызывает.
    // Список бэкендов читается при построении опций, а не при регистрации, — так его видят и переопределения в тестах.
    public static IServiceCollection AddGatewayInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<HealthOptions>(configuration.GetSection(HealthOptions.SectionName));

        // Таймаут задаёт сама проверка, повторы не нужны: стандартный resilience-хендлер из ServiceDefaults
        // повторял бы 503 и растянул ответ /health. API помечен экспериментальным (EXTEXP0001) — других способов
        // снять хендлер с одного клиента при ConfigureHttpClientDefaults нет.
#pragma warning disable EXTEXP0001
        services.AddHttpClient(BackendHealthClient.HttpClientName).RemoveAllResilienceHandlers();
#pragma warning restore EXTEXP0001

        services.AddSingleton<BackendHealthClient>();
        services.AddSingleton<BackendHealthChecks>();
        services.AddOptions<HealthCheckServiceOptions>().Configure<IOptions<HealthOptions>>((options, health) =>
        {
            foreach (var name in health.Value.Backends.Keys)
            {
                options.Registrations.Add(new HealthCheckRegistration(
                    name, sp => sp.GetRequiredService<BackendHealthChecks>()[name], HealthStatus.Unhealthy, tags: ["backend"]));
            }
        });

        return services;
    }
}
