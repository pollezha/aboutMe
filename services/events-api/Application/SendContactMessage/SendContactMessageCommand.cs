namespace EventsApi.Application.SendContactMessage;

/// <summary>
/// Message in a bottle as sent by the browser: raw fields, the honeypot <see cref="Website"/>, optional session
/// fields used only for the analytics event, and the client's <c>User-Agent</c>.
/// </summary>
public sealed record SendContactMessageCommand(
    string? Name,
    string? ReplyTo,
    string? Text,
    string? Website,
    string? SessionId,
    string? Lang,
    string? Theme,
    string? UserAgent);
