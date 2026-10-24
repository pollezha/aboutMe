using ContentApi.Application.GetContent;
using ContentApi.Application.SeedContent;

namespace ContentApi.Application;

public static class DependencyInjection
{
    /// <summary>Хендлеры сценариев; scoped — как репозитории и <c>DbContext</c>, от которых они зависят.</summary>
    public static IServiceCollection AddContentApiApplication(this IServiceCollection services)
    {
        services.AddScoped<GetContentHandler>();
        services.AddScoped<SeedContentHandler>();
        return services;
    }
}
