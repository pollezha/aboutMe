using System.Text.Json.Serialization;

namespace Contracts.Events;

/// <summary>Source-generated serialization of events: camelCase, fields in declaration order (design §5.4).</summary>
[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(SiteEvent))]
[JsonSerializable(typeof(IncomingEvent))]
public sealed partial class SiteEventJsonContext : JsonSerializerContext;
