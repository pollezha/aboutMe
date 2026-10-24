using System.Security.Cryptography;
using System.Text;
using ContentApi.Seeding;
using Xunit;

namespace ContentApi.Tests;

public sealed class ContentBundleValidatorTests
{
    private const string Source = "content/en.json";

    [Fact]
    public void Repository_bundles_are_valid()
    {
        foreach (var lang in ContentFiles.Langs)
        {
            var bytes = File.ReadAllBytes(Path.Combine(ContentFiles.RepositoryContentPath, $"{lang}.json"));

            var result = ContentBundleValidator.Validate(lang, $"content/{lang}.json", bytes);

            Assert.True(result.IsValid, string.Join("; ", result.Errors));
            Assert.Equal(lang, result.Info!.Lang);
            Assert.Equal(Convert.ToHexStringLower(SHA256.HashData(bytes)), result.Info.VersionHash);
        }
    }

    [Fact]
    public void Valid_bundle_without_schema_version_gets_version_1()
    {
        var result = Validate("en", """{ "contentVersion": "2026-10-20T00:00:00Z", "lang": "en" }""");

        Assert.True(result.IsValid, string.Join("; ", result.Errors));
        Assert.Equal("2026-10-20T00:00:00Z", result.Info!.ContentVersion);
        Assert.Equal(1, result.Info.SchemaVersion);
    }

    [Fact]
    public void Lang_not_matching_file_name_is_rejected()
    {
        var result = Validate("en", """{ "contentVersion": "2026-10-20T00:00:00Z", "lang": "ru" }""");

        Assert.False(result.IsValid);
        var error = Assert.Single(result.Errors);
        Assert.Contains(Source, error, StringComparison.Ordinal);
        Assert.Contains("lang", error, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("""{ "lang": "en" }""")]
    [InlineData("""{ "contentVersion": "", "lang": "en" }""")]
    [InlineData("""{ "contentVersion": "yesterday", "lang": "en" }""")]
    public void Missing_or_malformed_content_version_is_rejected(string json)
    {
        var result = Validate("en", json);

        var error = Assert.Single(result.Errors);
        Assert.Contains("contentVersion", error, StringComparison.Ordinal);
    }

    [Fact]
    public void Add_placeholder_is_rejected_with_field_path()
    {
        var result = Validate("en", """
            { "contentVersion": "2026-10-20T00:00:00Z", "lang": "en",
              "profile": { "highlights": [ { "note": "ok" }, { "note": "[ADD] metric" } ] } }
            """);

        var error = Assert.Single(result.Errors);
        Assert.Contains(Source, error, StringComparison.Ordinal);
        Assert.Contains("$.profile.highlights[1].note", error, StringComparison.Ordinal);
        Assert.Contains("[ADD]", error, StringComparison.Ordinal);
    }

    [Fact]
    public void Placeholder_href_is_rejected_with_field_path()
    {
        var result = Validate("en", """
            { "contentVersion": "2026-10-20T00:00:00Z", "lang": "en", "links": [ { "href": "#" } ] }
            """);

        var error = Assert.Single(result.Errors);
        Assert.Contains("$.links[0].href", error, StringComparison.Ordinal);
    }

    [Fact]
    public void Invalid_json_is_rejected()
    {
        var result = Validate("en", """{ "lang": "en", """);

        Assert.False(result.IsValid);
        Assert.Contains(Source, Assert.Single(result.Errors), StringComparison.Ordinal);
    }

    private static ContentValidationResult Validate(string lang, string json) =>
        ContentBundleValidator.Validate(lang, Source, Encoding.UTF8.GetBytes(json));
}
