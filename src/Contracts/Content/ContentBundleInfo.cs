namespace Contracts.Content;

/// <summary>
/// Version info of a content bundle served by content-api (one language). Not the whole content schema:
/// the bundle itself is validated against <c>content/schema/content.schema.json</c> in the frontend build.
/// </summary>
/// <param name="Lang"><c>en</c> or <c>ru</c>.</param>
/// <param name="ContentVersion">UTC time of the content commit, <c>yyyy-MM-ddTHH:mm:ssZ</c>; monotonic.</param>
/// <param name="VersionHash">Hash of the bundle bytes (ETag).</param>
/// <param name="SchemaVersion">Version of the bundle schema; the API is versioned by it (design §10).</param>
public sealed record ContentBundleInfo(string Lang, string ContentVersion, string VersionHash, int SchemaVersion);
