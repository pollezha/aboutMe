using ContentApi.Application.Abstractions;
using ContentApi.Domain;
using Microsoft.EntityFrameworkCore;

namespace ContentApi.Infrastructure.Persistence;

public sealed class ContentBundleRepository(ContentDbContext db) : IContentBundleRepository
{
    public Task<ContentBundle?> GetByLangAsync(string lang, CancellationToken cancellationToken) =>
        db.Bundles.AsNoTracking().FirstOrDefaultAsync(b => b.Lang == lang, cancellationToken);

    // Атомарно и без гонки между экземплярами: строка переписывается, только если хэш изменился
    public Task UpsertAsync(ContentBundle bundle, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(bundle);

        return db.Database.ExecuteSqlAsync($"""
            INSERT INTO content.bundles AS b (lang, content_version, version_hash, json, updated_at)
            VALUES ({bundle.Lang}, {bundle.ContentVersion}, {bundle.VersionHash}, {bundle.Json}::jsonb, now())
            ON CONFLICT (lang) DO UPDATE SET
                content_version = excluded.content_version,
                version_hash = excluded.version_hash,
                json = excluded.json,
                updated_at = excluded.updated_at
            WHERE b.version_hash IS DISTINCT FROM excluded.version_hash
            """, cancellationToken);
    }
}
