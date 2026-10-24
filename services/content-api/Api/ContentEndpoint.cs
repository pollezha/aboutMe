using System.Text;
using BuildingBlocks.Http;
using ContentApi.Application.GetContent;
using Microsoft.Net.Http.Headers;

namespace ContentApi.Api;

/// <summary><c>GET /api/content/{lang}</c>: бандл из БД с ETag и output cache (docs/design/architecture.md §5.7).</summary>
public static class ContentEndpoint
{
    public const string CachePolicy = "content";
    public static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(10);

    public static IServiceCollection AddContentOutputCache(this IServiceCollection services) =>
        services.AddOutputCache(options =>
            options.AddPolicy(CachePolicy, policy => policy.Expire(CacheDuration).SetVaryByRouteValue("lang")));

    public static IEndpointRouteBuilder MapContentEndpoint(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/content/{lang}", GetAsync).CacheOutput(CachePolicy);
        return app;
    }

    // Совпавший If-None-Match до кэша проверяет хендлер; ответ 200 из output cache сверяет с
    // If-None-Match сам OutputCacheMiddleware по сохранённому ETag
    private static async Task<IResult> GetAsync(
        string lang, HttpContext http, GetContentHandler handler, CancellationToken cancellationToken)
    {
        var ifNoneMatch = http.Request.GetTypedHeaders().IfNoneMatch.Select(tag => tag.ToString()).ToList();
        var result = await handler.HandleAsync(new GetContentQuery(lang, ifNoneMatch), cancellationToken);

        switch (result)
        {
            case GetContentResult.Found found:
                SetCacheHeaders(http, found.VersionHash);
                return TypedResults.Text(found.Json, "application/json", Encoding.UTF8);
            case GetContentResult.NotModified notModified:
                SetCacheHeaders(http, notModified.VersionHash);
                return TypedResults.StatusCode(StatusCodes.Status304NotModified);
            case GetContentResult.UnknownLang unknown:
                return HttpProblems.NotFound(
                    "Unknown language", $"Supported languages: {string.Join(", ", unknown.SupportedLangs)}.");
            default:
                return HttpProblems.ServiceUnavailable("Content is not available");
        }
    }

    private static void SetCacheHeaders(HttpContext http, string versionHash)
    {
        var headers = http.Response.GetTypedHeaders();
        headers.ETag = new EntityTagHeaderValue($"\"{versionHash}\"");
        headers.CacheControl = new CacheControlHeaderValue { Public = true, MaxAge = CacheDuration };
    }
}
