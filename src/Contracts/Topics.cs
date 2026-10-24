namespace Contracts;

/// <summary>Kafka topics. An incompatible event schema change means a new topic (<c>site.events.v2</c>).</summary>
public static class Topics
{
    public const string SiteEvents = "site.events.v1";
}

/// <summary>Kafka consumer groups reading <see cref="Topics.SiteEvents"/> (ADR-0002).</summary>
public static class ConsumerGroups
{
    public const string Projector = "projector";
    public const string LiveHub = "live-hub";
}

/// <summary>Kafka message headers.</summary>
public static class KafkaHeaders
{
    /// <summary>W3C trace context of the request that produced the event.</summary>
    public const string TraceParent = "traceparent";

    public const string SchemaVersion = "schema-version";

    /// <summary>Value of <see cref="SchemaVersion"/> for <see cref="Topics.SiteEvents"/>.</summary>
    public const string SchemaVersionValue = "1";
}
