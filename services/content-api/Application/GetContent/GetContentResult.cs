namespace ContentApi.Application.GetContent;

/// <summary>Исход <see cref="GetContentHandler"/>; HTTP-статус выбирает эндпоинт.</summary>
public abstract record GetContentResult
{
    private GetContentResult()
    {
    }

    /// <summary>Бандл найден, клиентский ETag не совпал (или не прислан).</summary>
    public sealed record Found(string Json, string VersionHash, string ContentVersion) : GetContentResult;

    /// <summary>ETag клиента совпал с текущим: тело не нужно.</summary>
    public sealed record NotModified(string VersionHash) : GetContentResult;

    public sealed record UnknownLang(IReadOnlyList<string> SupportedLangs) : GetContentResult;

    /// <summary>Язык известен, но бандл ещё не засеян.</summary>
    public sealed record Unavailable : GetContentResult;
}
