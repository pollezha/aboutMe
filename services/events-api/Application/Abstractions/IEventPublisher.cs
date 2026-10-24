using Contracts.Events;

namespace EventsApi.Application.Abstractions;

/// <summary>Writes an event to the event log (<see cref="Contracts.Topics.SiteEvents"/>).</summary>
public interface IEventPublisher
{
    /// <summary>Completes when the log acknowledged the event; throws when the log is unavailable.</summary>
    Task PublishAsync(SiteEvent siteEvent, CancellationToken cancellationToken);
}
