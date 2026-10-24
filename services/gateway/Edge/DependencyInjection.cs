namespace Gateway.Edge;

internal static class DependencyInjection
{
    // Политики периметра (design §5.2). Конфиг читается при построении опций, а не при регистрации, —
    // так его видят и переопределения в тестах.
    public static IServiceCollection AddGatewayEdge(this IServiceCollection services, IConfiguration configuration) =>
        services
            .AddGatewayForwardedHeaders(configuration)
            .AddGatewayCors(configuration)
            .AddGatewayRateLimiting(configuration)
            .AddGatewayBotFilter(configuration);
}
