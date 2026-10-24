using EventsApi.Domain;

namespace EventsApi.Application.Abstractions;

/// <summary>Forwards a message in a bottle to the owner (Telegram in production).</summary>
public interface IContactMessageDelivery
{
    /// <summary>Completes when the message was delivered; throws when delivery is unavailable.</summary>
    Task DeliverAsync(ContactMessage message, CancellationToken cancellationToken);
}
