using System.Xml.Linq;

namespace Architecture.Tests;

/// <summary>Граф «проект → ссылки» из services/*/*.csproj и src/*/*.csproj реального репозитория.</summary>
public static class RepositoryProjects
{
    public static string FindRoot()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            if (File.Exists(Path.Combine(dir.FullName, "aboutMe.slnx")))
            {
                return dir.FullName;
            }
        }

        throw new InvalidOperationException($"aboutMe.slnx not found above {AppContext.BaseDirectory}");
    }

    public static Dictionary<string, IReadOnlyList<string>> LoadGraph(string root)
    {
        var graph = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal);
        foreach (var area in new[] { "services", "src" })
        {
            var areaDir = Path.Combine(root, area);
            if (!Directory.Exists(areaDir))
            {
                continue;
            }

            foreach (var projectDir in Directory.EnumerateDirectories(areaDir))
            {
                foreach (var csproj in Directory.EnumerateFiles(projectDir, "*.csproj"))
                {
                    graph[ToRepoPath(root, projectDir)] = ReadReferences(root, csproj);
                }
            }
        }

        return graph;
    }

    private static List<string> ReadReferences(string root, string csproj)
    {
        var projectDir = Path.GetDirectoryName(csproj)!;
        return XDocument.Load(csproj)
            .Descendants()
            .Where(e => e.Name.LocalName == "ProjectReference")
            .Select(e => e.Attribute("Include")?.Value)
            .OfType<string>()
            .Select(include => Path.GetFullPath(Path.Combine(projectDir, include.Replace('\\', Path.DirectorySeparatorChar))))
            .Select(path => ToRepoPath(root, Path.GetDirectoryName(path)!))
            .ToList();
    }

    private static string ToRepoPath(string root, string path) =>
        Path.GetRelativePath(root, path).Replace('\\', '/');
}
