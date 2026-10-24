namespace EventsApi.Application.IngestEvents;

/// <summary>Outcome of <see cref="IngestEventsHandler"/>.</summary>
public abstract record IngestEventsResult
{
    private IngestEventsResult()
    {
    }

    /// <summary>Every event was written to the log.</summary>
    public sealed record Accepted : IngestEventsResult;

    /// <summary>At least one event is invalid; nothing was written. Errors by path (<c>field</c>, <c>[i].field</c>, <c>$</c>).</summary>
    public sealed record ValidationFailed(Dictionary<string, string[]> Errors) : IngestEventsResult;

    /// <summary>The event log is unavailable.</summary>
    public sealed record PublishFailed : IngestEventsResult;
}
