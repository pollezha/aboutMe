using System.Collections.Concurrent;
using Contracts.Events;
using EventsApi.Application.Abstractions;

namespace EventsApi.Tests.Application;

/// <summary>Event log stand-in: records published events or throws <see cref="Failure"/>.</summary>
public sealed class FakeEventPublisher : IEventPublisher
{
    public ConcurrentQueue<SiteEvent> Published { get; } = new();

    public Exception? Failure { get; set; }

    public Task PublishAsync(SiteEvent siteEvent, CancellationToken cancellationToken)
    {
        if (Failure is not null)
        {
            return Task.FromException(Failure);
        }

        Published.Enqueue(siteEvent);
        return Task.CompletedTask;
    }
}
