namespace Contracts.Events;

/// <summary>Invalid field; <see cref="Path"/> is its JSON path, e.g. <c>payload.source</c>.</summary>
public sealed record ValidationError(string Path, string Message);
