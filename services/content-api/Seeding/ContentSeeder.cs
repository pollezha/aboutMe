using ContentApi.Data;
using Contracts.Content;
using Microsoft.EntityFrameworkCore;

namespace ContentApi.Seeding;

/// <summary>
/// При старте читает <c>{en,ru}.json</c> из <c>Content:Path</c>, проверяет оба и делает upsert в
/// <c>content.bundles</c>, если изменился SHA-256 (docs/design/architecture.md §5.7). Любая ошибка не роняет
/// процесс: <c>/health</c> становится Unhealthy с описанием, <c>/alive</c> отвечает.
/// </summary>
public sealed partial class ContentSeeder(
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration,
    IHostEnvironment environment,
    ContentSeedState state,
    ILogger<ContentSeeder> logger) : IHostedService
{
    public static readonly IReadOnlyList<string> Langs = ["en", "ru"];

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        var folder = ResolveContentPath(configuration["Content:Path"], environment.ContentRootPath);
        if (folder is null)
        {
            Fail(["Content folder not found: set Content:Path"]);
            return;
        }

        var bundles = new List<(ContentBundleInfo Info, string Json)>();
        var errors = new List<string>();
        foreach (var lang in Langs)
        {
            var file = Path.Combine(folder, $"{lang}.json");
            if (!File.Exists(file))
            {
                errors.Add($"{file}: file not found");
                continue;
            }

            var bytes = await File.ReadAllBytesAsync(file, cancellationToken);
            var result = ContentBundleValidator.Validate(lang, file, bytes);
            if (result.IsValid)
            {
                bundles.Add((result.Info!, System.Text.Encoding.UTF8.GetString(bytes).TrimStart('﻿')));
            }
            else
            {
                errors.AddRange(result.Errors);
            }
        }

        if (errors.Count > 0)
        {
            Fail(errors);
            return;
        }

        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            foreach (var (info, json) in bundles)
            {
                var changed = await UpsertAsync(db, info, json, cancellationToken);
                LogSeeded(logger, info.Lang, info.ContentVersion, info.VersionHash, changed > 0);
            }
        }
#pragma warning disable CA1031 // недоступная БД или незаполненная схема → Unhealthy, а не падение процесса
        catch (Exception ex) when (ex is not OperationCanceledException)
#pragma warning restore CA1031
        {
            LogStoreFailed(logger, ex);
            state.Failed($"Content seeding failed: {ex.Message}");
            return;
        }

        state.Succeeded(string.Join(", ", bundles.Select(b => $"{b.Info.Lang} {b.Info.ContentVersion}")));
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    /// <summary>
    /// Явный <c>Content:Path</c> (относительно корня приложения) или первая папка <c>content</c> с <c>en.json</c>
    /// вверх от каталога сборки: <c>dotnet run</c> из репозитория и <c>/app/content</c> в образе.
    /// </summary>
    public static string? ResolveContentPath(string? configured, string contentRootPath)
    {
        if (!string.IsNullOrWhiteSpace(configured))
        {
            return Path.GetFullPath(Path.Combine(contentRootPath, configured));
        }

        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, "content");
            if (File.Exists(Path.Combine(candidate, "en.json")))
            {
                return candidate;
            }
        }

        return null;
    }

    // Атомарно и без гонки между экземплярами: строка переписывается, только если хэш изменился
    private static Task<int> UpsertAsync(ContentDbContext db, ContentBundleInfo info, string json, CancellationToken ct) =>
        db.Database.ExecuteSqlAsync($"""
            INSERT INTO content.bundles AS b (lang, content_version, version_hash, json, updated_at)
            VALUES ({info.Lang}, {info.ContentVersion}, {info.VersionHash}, {json}::jsonb, now())
            ON CONFLICT (lang) DO UPDATE SET
                content_version = excluded.content_version,
                version_hash = excluded.version_hash,
                json = excluded.json,
                updated_at = excluded.updated_at
            WHERE b.version_hash IS DISTINCT FROM excluded.version_hash
            """, ct);

    private void Fail(IReadOnlyList<string> errors)
    {
        foreach (var error in errors)
        {
            LogInvalid(logger, error);
        }

        state.Failed($"Invalid content: {string.Join("; ", errors)}");
    }

    [LoggerMessage(Level = LogLevel.Error, Message = "Content bundle rejected: {Error}")]
    private static partial void LogInvalid(ILogger logger, string error);

    [LoggerMessage(Level = LogLevel.Error, Message = "Content bundles could not be stored")]
    private static partial void LogStoreFailed(ILogger logger, Exception exception);

    [LoggerMessage(Level = LogLevel.Information,
        Message = "Content bundle {Lang} {ContentVersion} ({VersionHash}) seeded, changed: {Changed}")]
    private static partial void LogSeeded(ILogger logger, string lang, string contentVersion, string versionHash, bool changed);
}
