using System.Text.Json.Serialization;

namespace Contracts.Content;

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(ContentBundleInfo))]
public sealed partial class ContentJsonContext : JsonSerializerContext;
