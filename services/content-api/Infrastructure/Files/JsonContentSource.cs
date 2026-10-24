using ContentApi.Application.Abstractions;

namespace ContentApi.Infrastructure.Files;

/// <summary>
/// Файлы <c>{lang}.json</c> из папки <c>Content:Path</c> (относительно корня приложения) или, если путь не задан,
/// из первой папки <c>content</c> с <c>en.json</c> вверх от каталога сборки: <c>dotnet run</c> из репозитория и
/// <c>/app/content</c> в образе.
/// </summary>
public sealed class JsonContentSource(IConfiguration configuration, IHostEnvironment environment) : IContentSource
{
    public async Task<ContentSourceFile> ReadAsync(string lang, CancellationToken cancellationToken)
    {
        var folder = ResolveContentPath(configuration["Content:Path"], environment.ContentRootPath)
            ?? throw new DirectoryNotFoundException("Content folder not found: set Content:Path");

        var file = Path.Combine(folder, $"{lang}.json");
        return File.Exists(file)
            ? new ContentSourceFile(file, await File.ReadAllBytesAsync(file, cancellationToken))
            : new ContentSourceFile(file, null);
    }

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
}
