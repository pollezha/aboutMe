using Contracts.Events;
using EventsApi.Application.IngestEvents;
using EventsApi.Application.SendContactMessage;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace EventsApi.Application;

public static class DependencyInjection
{
    /// <summary>Handlers of <c>IngestEvents</c> and <c>SendContactMessage</c> with the event contract validator.</summary>
    public static IServiceCollection AddEventsApiApplication(this IServiceCollection services)
    {
        services.TryAddSingleton(TimeProvider.System);
        services.AddSingleton<EventValidator>();
        services.AddScoped<IngestEventsHandler>();
        services.AddScoped<SendContactMessageHandler>();
        return services;
    }
}
