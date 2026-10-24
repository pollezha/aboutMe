using ContentApi.Application.Abstractions;
using ContentApi.Domain;

namespace ContentApi.Application.GetContent;

/// <summary>Бандл языка и сверка ETag клиента (слабое сравнение, RFC 9110 §13.1.2).</summary>
public sealed class GetContentHandler(IContentBundleRepository bundles)
{
    private const string WeakPrefix = "W/";
    private const string AnyTag = "*";

    public async Task<GetContentResult> HandleAsync(GetContentQuery query, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        if (!ContentBundle.IsSupported(query.Lang))
        {
            return new GetContentResult.UnknownLang(ContentBundle.SupportedLangs);
        }

        var bundle = await bundles.GetByLangAsync(query.Lang, cancellationToken);
        if (bundle is null)
        {
            return new GetContentResult.Unavailable();
        }

        return Matches(query.IfNoneMatch, bundle.VersionHash)
            ? new GetContentResult.NotModified(bundle.VersionHash)
            : new GetContentResult.Found(bundle.Json, bundle.VersionHash, bundle.ContentVersion);
    }

    private static bool Matches(IReadOnlyList<string> ifNoneMatch, string versionHash)
    {
        var current = $"\"{versionHash}\"";
        return ifNoneMatch.Any(tag =>
        {
            var opaque = tag.StartsWith(WeakPrefix, StringComparison.Ordinal) ? tag[WeakPrefix.Length..] : tag;
            return opaque == AnyTag || string.Equals(opaque, current, StringComparison.Ordinal);
        });
    }
}
