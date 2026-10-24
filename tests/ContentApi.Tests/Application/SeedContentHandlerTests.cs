using System.Security.Cryptography;
using System.Text;
using BuildingBlocks.Persistence;
using ContentApi.Application.Abstractions;
using ContentApi.Application.SeedContent;
using ContentApi.Domain;
using Xunit;

namespace ContentApi.Tests.Application;

public sealed class SeedContentHandlerTests : IAsyncDisposable
{
    private static readonly string[] Langs = ["en", "ru"];

    private readonly FakeContentBundleRepository _repository = new();
    private readonly FakeContentSource _source = new();
    private readonly FakeUnitOfWork _unitOfWork = new();

    public SeedContentHandlerTests()
    {
        _source.Files["en"] = Bundle("en");
        _source.Files["ru"] = Bundle("ru");
    }

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public ValueTask DisposeAsync() => _unitOfWork.DisposeAsync();

    [Fact]
    public async Task Unchanged_hash_is_not_upserted()
    {
        StoreCurrent("en");
        StoreCurrent("ru");

        var result = await Handle();

        var seeded = Assert.IsType<SeedContentResult.Seeded>(result);
        Assert.Equal(2, seeded.Bundles.Count);
        Assert.All(seeded.Bundles, b => Assert.False(b.Changed));
        Assert.Empty(_repository.Upserted);
        Assert.False(_unitOfWork.Committed);
    }

    [Fact]
    public async Task Changed_hash_is_upserted_and_committed()
    {
        _repository.Add(new ContentBundle
        {
            Lang = "en",
            ContentVersion = "2026-01-01T00:00:00Z",
            VersionHash = "old",
            Json = "{}",
        });
        StoreCurrent("ru");

        var result = await Handle();

        var seeded = Assert.IsType<SeedContentResult.Seeded>(result);
        var upserted = Assert.Single(_repository.Upserted);
        Assert.Equal("en", upserted.Lang);
        Assert.Equal(HashOf(_source.Files["en"]), upserted.VersionHash);
        Assert.Equal("2026-10-20T00:00:00Z", upserted.ContentVersion);
        Assert.Equal(Encoding.UTF8.GetString(_source.Files["en"]), upserted.Json);
        Assert.True(seeded.Bundles.Single(b => b.Lang == "en").Changed);
        Assert.True(_unitOfWork.Committed);
    }

    [Fact]
    public async Task Invalid_bundle_fails_with_path_and_nothing_is_upserted()
    {
        _source.Files["ru"] = Encoding.UTF8.GetBytes(
            """{ "contentVersion": "2026-10-20T00:00:00Z", "lang": "ru", "todo": "[ADD] text" }""");

        var result = await Handle();

        var failed = Assert.IsType<SeedContentResult.Failed>(result);
        var error = Assert.Single(failed.Errors);
        Assert.Contains(FakeContentSource.PathOf("ru"), error, StringComparison.Ordinal);
        Assert.Contains("$.todo", error, StringComparison.Ordinal);
        Assert.Empty(_repository.Upserted);
        Assert.False(_unitOfWork.Committed);
    }

    [Fact]
    public async Task Missing_file_fails_with_path()
    {
        _source.Files.Remove("en");

        var result = await Handle();

        var failed = Assert.IsType<SeedContentResult.Failed>(result);
        Assert.Contains(FakeContentSource.PathOf("en"), Assert.Single(failed.Errors), StringComparison.Ordinal);
        Assert.Empty(_repository.Upserted);
    }

    private Task<SeedContentResult> Handle() =>
        new SeedContentHandler(_source, _repository, _unitOfWork).HandleAsync(new SeedContentCommand(Langs), Ct);

    private void StoreCurrent(string lang) =>
        _repository.Add(new ContentBundle
        {
            Lang = lang,
            ContentVersion = "2026-10-20T00:00:00Z",
            VersionHash = HashOf(_source.Files[lang]),
            Json = "{}",
        });

    private static byte[] Bundle(string lang) =>
        Encoding.UTF8.GetBytes($$"""{ "contentVersion": "2026-10-20T00:00:00Z", "lang": "{{lang}}" }""");

    private static string HashOf(byte[] bytes) => Convert.ToHexStringLower(SHA256.HashData(bytes));

    private sealed class FakeContentSource : IContentSource
    {
        public Dictionary<string, byte[]> Files { get; } = new(StringComparer.Ordinal);

        public static string PathOf(string lang) => $"content/{lang}.json";

        public Task<ContentSourceFile> ReadAsync(string lang, CancellationToken cancellationToken) =>
            Task.FromResult(new ContentSourceFile(PathOf(lang), Files.GetValueOrDefault(lang)));
    }

    private sealed class FakeUnitOfWork : IUnitOfWork
    {
        private bool _open;

        public bool Committed { get; private set; }

        public Task BeginAsync(CancellationToken cancellationToken)
        {
            _open = true;
            return Task.CompletedTask;
        }

        public Task CommitAsync(CancellationToken cancellationToken)
        {
            Assert.True(_open, "CommitAsync without BeginAsync");
            Committed = true;
            return Task.CompletedTask;
        }

        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
    }
}
