using ContentApi.Application.Abstractions;
using ContentApi.Domain;

namespace ContentApi.Tests.Application;

/// <summary>Хранилище бандлов в памяти; запоминает вызовы <see cref="UpsertAsync"/>.</summary>
internal sealed class FakeContentBundleRepository : IContentBundleRepository
{
    private readonly Dictionary<string, ContentBundle> _bundles = new(StringComparer.Ordinal);

    public List<ContentBundle> Upserted { get; } = [];

    public void Add(ContentBundle bundle) => _bundles[bundle.Lang] = bundle;

    public Task<ContentBundle?> GetByLangAsync(string lang, CancellationToken cancellationToken) =>
        Task.FromResult(_bundles.GetValueOrDefault(lang));

    public Task UpsertAsync(ContentBundle bundle, CancellationToken cancellationToken)
    {
        Upserted.Add(bundle);
        _bundles[bundle.Lang] = bundle;
        return Task.CompletedTask;
    }
}
