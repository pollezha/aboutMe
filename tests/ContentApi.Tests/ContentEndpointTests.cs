using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text.Json;
using ContentApi.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Xunit;

namespace ContentApi.Tests;

[Trait("Category", "Integration")]
public sealed class ContentEndpointTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>, IDisposable
{
    private readonly ContentFiles _content = new();

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public void Dispose() => _content.Dispose();

    [Fact]
    public async Task Get_returns_bundle_from_file_with_etag_and_cache_headers()
    {
        await using var factory = CreateFactory(await postgres.NewMigratedDatabaseAsync(Ct));
        var client = factory.CreateClient();

        var response = await client.GetAsync("/api/content/en", Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("utf-8", response.Content.Headers.ContentType?.CharSet);
        Assert.Equal(ExpectedETag("en"), response.Headers.ETag);
        Assert.True(response.Headers.CacheControl?.Public);
        Assert.Equal(TimeSpan.FromSeconds(600), response.Headers.CacheControl?.MaxAge);
        Assert.Equal(ContentVersionOf(_content.Read("en")), ContentVersionOf(await response.Content.ReadAsStringAsync(Ct)));
    }

    [Fact]
    public async Task Matching_if_none_match_returns_304_on_cache_miss_and_on_cache_hit()
    {
        await using var factory = CreateFactory(await postgres.NewMigratedDatabaseAsync(Ct));
        var client = factory.CreateClient();

        // Первый запрос — ответ ещё не в output cache: ETag сверяет сам эндпоинт
        var miss = await GetAsync(client, "/api/content/ru", ExpectedETag("ru"));
        Assert.Equal(HttpStatusCode.NotModified, miss.StatusCode);
        Assert.Empty(await miss.Content.ReadAsByteArrayAsync(Ct));

        // 200 кладёт ответ в output cache; повтор с If-None-Match обслуживается из кэша
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/content/ru", Ct)).StatusCode);
        var hit = await GetAsync(client, "/api/content/ru", ExpectedETag("ru"));
        Assert.Equal(HttpStatusCode.NotModified, hit.StatusCode);
        Assert.Empty(await hit.Content.ReadAsByteArrayAsync(Ct));

        var stale = await GetAsync(client, "/api/content/ru", new EntityTagHeaderValue("\"stale\""));
        Assert.Equal(HttpStatusCode.OK, stale.StatusCode);
    }

    [Fact]
    public async Task Output_cache_varies_by_language()
    {
        await using var factory = CreateFactory(await postgres.NewMigratedDatabaseAsync(Ct));
        var client = factory.CreateClient();

        var en = await client.GetAsync("/api/content/en", Ct);
        var ru = await client.GetAsync("/api/content/ru", Ct);

        Assert.Equal(ExpectedETag("en"), en.Headers.ETag);
        Assert.Equal(ExpectedETag("ru"), ru.Headers.ETag);
    }

    [Theory]
    [InlineData("de")]
    [InlineData("EN")]
    public async Task Unknown_language_returns_404_problem_details(string lang)
    {
        await using var factory = CreateFactory(await postgres.NewMigratedDatabaseAsync(Ct));
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/api/content/{lang}", Ct);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Changed_file_is_served_with_new_etag_after_restart()
    {
        var connectionString = await postgres.NewMigratedDatabaseAsync(Ct);
        EntityTagHeaderValue? before;
        await using (var first = CreateFactory(connectionString))
        {
            before = (await first.CreateClient().GetAsync("/api/content/en", Ct)).Headers.ETag;
        }

        _content.Write("en", _content.Read("en").Replace("2026-10-20T00:00:00Z", "2030-01-02T03:04:05Z", StringComparison.Ordinal));

        await using var second = CreateFactory(connectionString);
        var response = await second.CreateClient().GetAsync("/api/content/en", Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotEqual(before, response.Headers.ETag);
        Assert.Equal(ExpectedETag("en"), response.Headers.ETag);
        Assert.Equal("2030-01-02T03:04:05Z", ContentVersionOf(await response.Content.ReadAsStringAsync(Ct)));
    }

    [Fact]
    public async Task Unchanged_file_is_not_rewritten_on_restart()
    {
        var connectionString = await postgres.NewMigratedDatabaseAsync(Ct);
        await using (var first = CreateFactory(connectionString))
        {
            first.CreateClient();
        }

        var updatedAt = await UpdatedAtAsync(connectionString);
        await using (var second = CreateFactory(connectionString))
        {
            second.CreateClient();
        }

        Assert.Equal(updatedAt, await UpdatedAtAsync(connectionString));
    }

    [Fact]
    public async Task Health_is_ok_after_seed()
    {
        await using var factory = CreateFactory(await postgres.NewMigratedDatabaseAsync(Ct));
        var client = factory.CreateClient();

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health", Ct)).StatusCode);
    }

    [Fact]
    public async Task Placeholder_in_file_makes_service_unhealthy_but_alive()
    {
        _content.Write("ru", _content.Read("ru").Replace("\"lang\": \"ru\",", "\"lang\": \"ru\", \"todo\": \"[ADD] text\",", StringComparison.Ordinal));
        await using var factory = CreateFactory(await postgres.NewMigratedDatabaseAsync(Ct));
        var client = factory.CreateClient();

        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await client.GetAsync("/health", Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/alive", Ct)).StatusCode);

        var report = await factory.Services.GetRequiredService<HealthCheckService>()
            .CheckHealthAsync(r => r.Name == "content", Ct);
        var entry = report.Entries["content"];
        Assert.Equal(HealthStatus.Unhealthy, entry.Status);
        Assert.Contains("ru.json", entry.Description, StringComparison.Ordinal);
        Assert.Contains("$.todo", entry.Description, StringComparison.Ordinal);
    }

    private WebApplicationFactory<Program> CreateFactory(string connectionString) =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(b => b
            .UseSetting($"ConnectionStrings:{ContentDbContext.ConnectionName}", connectionString)
            .UseSetting("Content:Path", _content.Path));

    private static Task<HttpResponseMessage> GetAsync(HttpClient client, string url, EntityTagHeaderValue etag)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.IfNoneMatch.Add(etag);
        return client.SendAsync(request, Ct);
    }

    private EntityTagHeaderValue ExpectedETag(string lang) =>
        new($"\"{Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(_content.FileOf(lang))))}\"");

    private static string? ContentVersionOf(string json)
    {
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.GetProperty("contentVersion").GetString();
    }

    private static async Task<DateTimeOffset> UpdatedAtAsync(string connectionString)
    {
        await using var services = PostgresFixture.CreateServices(connectionString);
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
        return await db.Bundles.Where(b => b.Lang == "en").Select(b => b.UpdatedAt).SingleAsync(Ct);
    }
}
