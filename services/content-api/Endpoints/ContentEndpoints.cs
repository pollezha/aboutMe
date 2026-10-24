using System.Text;
using ContentApi.Data;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Net.Http.Headers;

namespace ContentApi.Endpoints;

/// <summary><c>GET /api/content/{lang}</c>: бандл из БД с ETag и output cache (docs/design/architecture.md §5.7).</summary>
public static class ContentEndpoints
{
    public const string CachePolicy = "content";
    public static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(10);
    private static readonly string[] Langs = ["en", "ru"];

    public static IServiceCollection AddContentOutputCache(this IServiceCollection services) =>
        services.AddOutputCache(options =>
            options.AddPolicy(CachePolicy, policy => policy.Expire(CacheDuration).SetVaryByRouteValue("lang")));

    public static IEndpointRouteBuilder MapContentEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/content/{lang}", GetBundleAsync).CacheOutput(CachePolicy);
        return app;
    }

    // Совпавший If-None-Match до кэша проверяет этот обработчик; ответ 200 из output cache сверяет с
    // If-None-Match сам OutputCacheMiddleware по сохранённому ETag
    private static async Task<Results<ContentHttpResult, StatusCodeHttpResult, ProblemHttpResult>> GetBundleAsync(
        string lang, HttpContext http, ContentDbContext db, CancellationToken cancellationToken)
    {
        if (!Langs.Contains(lang, StringComparer.Ordinal))
        {
            return TypedResults.Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "Unknown language",
                detail: $"Supported languages: {string.Join(", ", Langs)}.");
        }

        var bundle = await db.Bundles.AsNoTracking()
            .Where(b => b.Lang == lang)
            .Select(b => new { b.Json, b.VersionHash })
            .FirstOrDefaultAsync(cancellationToken);
        if (bundle is null)
        {
            return TypedResults.Problem(
                statusCode: StatusCodes.Status503ServiceUnavailable,
                title: "Content is not available");
        }

        var etag = new EntityTagHeaderValue($"\"{bundle.VersionHash}\"");
        var headers = http.Response.GetTypedHeaders();
        headers.ETag = etag;
        headers.CacheControl = new CacheControlHeaderValue { Public = true, MaxAge = CacheDuration };

        var ifNoneMatch = http.Request.GetTypedHeaders().IfNoneMatch;
        if (ifNoneMatch.Any(tag => tag.Equals(EntityTagHeaderValue.Any) || tag.Compare(etag, useStrongComparison: false)))
        {
            return TypedResults.StatusCode(StatusCodes.Status304NotModified);
        }

        return TypedResults.Text(bundle.Json, "application/json", Encoding.UTF8);
    }
}
