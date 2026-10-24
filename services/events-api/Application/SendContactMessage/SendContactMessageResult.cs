namespace EventsApi.Application.SendContactMessage;

/// <summary>Outcome of <see cref="SendContactMessageHandler"/>.</summary>
public abstract record SendContactMessageResult
{
    private SendContactMessageResult()
    {
    }

    /// <summary>The message reached the owner.</summary>
    public sealed record Delivered : SendContactMessageResult;

    /// <summary>The honeypot was filled: a bot, dropped silently.</summary>
    public sealed record Ignored : SendContactMessageResult;

    /// <summary>Errors by field (<c>name</c>, <c>replyTo</c>, <c>text</c>); nothing was sent.</summary>
    public sealed record ValidationFailed(Dictionary<string, string[]> Errors) : SendContactMessageResult;

    /// <summary>Delivery is unavailable.</summary>
    public sealed record DeliveryFailed : SendContactMessageResult;
}
