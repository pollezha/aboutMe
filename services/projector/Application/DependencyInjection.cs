using Microsoft.Extensions.DependencyInjection;
using Projector.Application.ProjectEvents;
using Projector.Application.RebuildStats;

namespace Projector.Application;

public static class DependencyInjection
{
    /// <summary>Хендлеры сценариев; scoped — вместе с unit of work и репозиториями своего scope.</summary>
    public static IServiceCollection AddProjectorApplication(this IServiceCollection services)
    {
        services.AddScoped<ProjectEventsHandler>();
        services.AddScoped<RebuildStatsHandler>();
        return services;
    }
}
