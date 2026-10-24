using System.Text.Json.Serialization;

namespace Contracts.Live;

/// <summary>Client methods invoked by the <c>/hubs/live</c> hub.</summary>
public static class LiveHubMethods
{
    /// <summary><see cref="LiveSnapshot"/> sent to a client right after it connects.</summary>
    public const string Snapshot = "snapshot";

    /// <summary><see cref="LiveSnapshot"/> broadcast at most once a second when counters change.</summary>
    public const string Counters = "counters";

    /// <summary><see cref="LiveMetrics"/> broadcast every 10 s.</summary>
    public const string Metrics = "metrics";
}

/// <summary>
/// Live counters of the site (design §5.6), message of the <c>/hubs/live</c> hub: <c>snapshot</c> on connect,
/// then <c>counters</c> at most once a second. Only aggregates, no per-visitor feed.
/// </summary>
/// <param name="Online">Unique sessions active within the last 5 minutes.</param>
/// <param name="EventsToday">Events received since the start of the current UTC day.</param>
/// <param name="ByType">Today's events by type (<see cref="Events.EventTypes"/>).</param>
/// <param name="ByStop">Today's <c>stop_opened</c> by stop.</param>
/// <param name="ByCta">Today's <c>cta_click</c> by target.</param>
/// <param name="AsOf">Server time of the snapshot.</param>
public sealed record LiveSnapshot(
    int Online,
    int EventsToday,
    Dictionary<string, int> ByType,
    Dictionary<string, int> ByStop,
    Dictionary<string, int> ByCta,
    DateTimeOffset AsOf);

/// <summary>
/// Service metrics for the <c>metrics</c> message of <c>/hubs/live</c>, every 10 s. Until stage 5 (Prometheus)
/// <see cref="Available"/> is <c>false</c> and all values are <c>null</c>.
/// </summary>
/// <param name="Available">Whether the values were obtained from Prometheus.</param>
/// <param name="Rpm">Requests per minute at the gateway.</param>
/// <param name="P95Ms">95th percentile of request duration, ms.</param>
/// <param name="ErrorRate">Share of 5xx responses, 0..1.</param>
/// <param name="ConsumerLag">Lag of the consumer groups, messages.</param>
/// <param name="Uptime">Time since the backend start, seconds.</param>
/// <param name="AsOf">Server time of the values.</param>
/// <param name="Note">Why the values are missing, if they are.</param>
public sealed record LiveMetrics(
    bool Available,
    double? Rpm,
    double? P95Ms,
    double? ErrorRate,
    long? ConsumerLag,
    double? Uptime,
    DateTimeOffset AsOf,
    string? Note)
{
    public static LiveMetrics Unavailable(DateTimeOffset asOf) =>
        new(false, null, null, null, null, null, asOf, "Prometheus — stage 5");
}

/// <summary>Source-generated serialization of <c>/hubs/live</c> messages: camelCase.</summary>
[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(LiveSnapshot))]
[JsonSerializable(typeof(LiveMetrics))]
public sealed partial class LiveJsonContext : JsonSerializerContext;
