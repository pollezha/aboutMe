using System.Collections.Concurrent;
using EventsApi.Application.Abstractions;
using EventsApi.Domain;

namespace EventsApi.Tests.Application;

/// <summary>Owner's inbox stand-in: records delivered messages or throws <see cref="Failure"/>.</summary>
public sealed class FakeContactMessageDelivery : IContactMessageDelivery
{
    public ConcurrentQueue<ContactMessage> Delivered { get; } = new();

    public Exception? Failure { get; set; }

    public Task DeliverAsync(ContactMessage message, CancellationToken cancellationToken)
    {
        if (Failure is not null)
        {
            return Task.FromException(Failure);
        }

        Delivered.Enqueue(message);
        return Task.CompletedTask;
    }
}
