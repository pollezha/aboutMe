using System.Text.Json;
using System.Text.Json.Serialization;

namespace EventsApi.Api;

/// <summary>Body of <c>POST /api/messages</c>; session fields are optional and used only for the analytics event.</summary>
public sealed record MessageRequest(
    string? Name,
    string? ReplyTo,
    string? Text,
    string? Website,
    string? SessionId,
    string? Lang,
    string? Theme);

[JsonSourceGenerationOptions(JsonSerializerDefaults.Web)]
[JsonSerializable(typeof(MessageRequest))]
internal sealed partial class MessageRequestJsonContext : JsonSerializerContext;
