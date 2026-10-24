using System.Text.Json;
using System.Text.Json.Serialization;

namespace EventsApi.Application.SendContactMessage;

/// <summary>Payload of the <c>cta_click</c> event written after a delivered message: only the target, no content.</summary>
internal sealed record BottleClickPayload(string Cta);

[JsonSourceGenerationOptions(JsonSerializerDefaults.Web)]
[JsonSerializable(typeof(BottleClickPayload))]
internal sealed partial class BottleClickPayloadJsonContext : JsonSerializerContext;
