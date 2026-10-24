using System.Text;
using BuildingBlocks.Persistence;
using ContentApi.Application.Abstractions;
using ContentApi.Domain;

namespace ContentApi.Application.SeedContent;

/// <summary>
/// Читает бандлы всех языков, проверяет каждый (<see cref="ContentBundleValidator"/>) и в одной транзакции
/// записывает те, у которых изменился SHA-256 (docs/design/architecture.md §5.7). Хотя бы один невалидный
/// бандл — не пишется ничего.
/// </summary>
public sealed class SeedContentHandler(IContentSource source, IContentBundleRepository bundles, IUnitOfWork unitOfWork)
{
    private const char ByteOrderMark = '﻿';

    public async Task<SeedContentResult> HandleAsync(SeedContentCommand command, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        var candidates = new List<ContentBundle>();
        var errors = new List<string>();
        foreach (var lang in command.Langs)
        {
            var file = await source.ReadAsync(lang, cancellationToken);
            if (file.Utf8Json is null)
            {
                errors.Add($"{file.SourcePath}: file not found");
                continue;
            }

            var validation = ContentBundleValidator.Validate(lang, file.SourcePath, file.Utf8Json);
            if (!validation.IsValid)
            {
                errors.AddRange(validation.Errors);
                continue;
            }

            var info = validation.Info!;
            candidates.Add(new ContentBundle
            {
                Lang = info.Lang,
                ContentVersion = info.ContentVersion,
                VersionHash = info.VersionHash,
                Json = Encoding.UTF8.GetString(file.Utf8Json).TrimStart(ByteOrderMark),
            });
        }

        if (errors.Count > 0)
        {
            return new SeedContentResult.Failed(errors);
        }

        var changed = new List<ContentBundle>();
        foreach (var bundle in candidates)
        {
            var stored = await bundles.GetByLangAsync(bundle.Lang, cancellationToken);
            if (!string.Equals(stored?.VersionHash, bundle.VersionHash, StringComparison.Ordinal))
            {
                changed.Add(bundle);
            }
        }

        if (changed.Count > 0)
        {
            await unitOfWork.BeginAsync(cancellationToken);
            foreach (var bundle in changed)
            {
                await bundles.UpsertAsync(bundle, cancellationToken);
            }

            await unitOfWork.CommitAsync(cancellationToken);
        }

        return new SeedContentResult.Seeded(candidates
            .Select(b => new SeededBundle(b.Lang, b.ContentVersion, b.VersionHash, changed.Contains(b)))
            .ToList());
    }
}
