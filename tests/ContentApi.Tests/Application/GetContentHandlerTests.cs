using ContentApi.Application.GetContent;
using ContentApi.Domain;
using Xunit;

namespace ContentApi.Tests.Application;

public sealed class GetContentHandlerTests
{
    private const string Hash = "abc123";
    private const string Json = """{ "contentVersion": "2026-10-20T00:00:00Z", "lang": "en" }""";

    private readonly FakeContentBundleRepository _repository = new();

    public GetContentHandlerTests() =>
        _repository.Add(new ContentBundle { Lang = "en", ContentVersion = "2026-10-20T00:00:00Z", VersionHash = Hash, Json = Json });

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Theory]
    [InlineData("\"abc123\"")]
    [InlineData("W/\"abc123\"")]
    [InlineData("*")]
    public async Task Matching_etag_returns_not_modified(string ifNoneMatch)
    {
        var result = await Handle("en", "\"other\"", ifNoneMatch);

        var notModified = Assert.IsType<GetContentResult.NotModified>(result);
        Assert.Equal(Hash, notModified.VersionHash);
    }

    [Fact]
    public async Task Other_etag_returns_bundle()
    {
        var result = await Handle("en", "\"stale\"");

        var found = Assert.IsType<GetContentResult.Found>(result);
        Assert.Equal(Json, found.Json);
        Assert.Equal(Hash, found.VersionHash);
        Assert.Equal("2026-10-20T00:00:00Z", found.ContentVersion);
    }

    [Fact]
    public async Task No_etag_returns_bundle() =>
        Assert.IsType<GetContentResult.Found>(await Handle("en"));

    [Theory]
    [InlineData("de")]
    [InlineData("EN")]
    public async Task Unknown_language_is_reported(string lang) =>
        Assert.IsType<GetContentResult.UnknownLang>(await Handle(lang));

    [Fact]
    public async Task Missing_bundle_is_unavailable() =>
        Assert.IsType<GetContentResult.Unavailable>(await Handle("ru"));

    private Task<GetContentResult> Handle(string lang, params string[] ifNoneMatch) =>
        new GetContentHandler(_repository).HandleAsync(new GetContentQuery(lang, ifNoneMatch), Ct);
}
