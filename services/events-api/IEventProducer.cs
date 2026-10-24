using Contracts.Events;

namespace EventsApi;

/// <summary>Writes an event to the event log (<see cref="Contracts.Topics.SiteEvents"/>).</summary>
public interface IEventProducer
{
    /// <summary>Completes when the broker acknowledged the event; throws when the log is unavailable.</summary>
    Task ProduceAsync(SiteEvent siteEvent, CancellationToken cancellationToken);
}
