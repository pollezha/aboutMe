namespace ContentApi.Tests;

/// <summary>Копия репозиторного <c>content/</c> во временной папке — тест может её портить.</summary>
public sealed class ContentFiles : IDisposable
{
    public static readonly string[] Langs = ["en", "ru"];

    public ContentFiles()
    {
        Path = System.IO.Path.Combine(System.IO.Path.GetTempPath(), $"content-api-tests-{Guid.NewGuid():N}");
        Directory.CreateDirectory(Path);
        foreach (var lang in Langs)
        {
            File.Copy(System.IO.Path.Combine(RepositoryContentPath, $"{lang}.json"), FileOf(lang));
        }
    }

    public string Path { get; }

    public static string RepositoryContentPath { get; } = FindRepositoryContent();

    public string FileOf(string lang) => System.IO.Path.Combine(Path, $"{lang}.json");

    public string Read(string lang) => File.ReadAllText(FileOf(lang));

    public void Write(string lang, string text) => File.WriteAllText(FileOf(lang), text);

    public void Dispose() => Directory.Delete(Path, recursive: true);

    private static string FindRepositoryContent()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            if (File.Exists(System.IO.Path.Combine(dir.FullName, "aboutMe.slnx")))
            {
                return System.IO.Path.Combine(dir.FullName, "content");
            }
        }

        throw new InvalidOperationException($"aboutMe.slnx not found above {AppContext.BaseDirectory}");
    }
}
