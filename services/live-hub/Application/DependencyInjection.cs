using LiveHub.Application.ApplyLiveEvent;
using LiveHub.Application.GetLiveSnapshot;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace LiveHub.Application;

public static class DependencyInjection
{
    /// <summary>Handlers of <c>ApplyLiveEvent</c> and <c>GetLiveSnapshot</c>; state lives in a singleton repository.</summary>
    public static IServiceCollection AddLiveHubApplication(this IServiceCollection services)
    {
        services.TryAddSingleton(TimeProvider.System);
        services.AddSingleton<ApplyLiveEventHandler>();
        services.AddSingleton<GetLiveSnapshotHandler>();
        return services;
    }
}
