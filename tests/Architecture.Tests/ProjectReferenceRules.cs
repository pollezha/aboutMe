namespace Architecture.Tests;

/// <summary>
/// Правила ссылок между проектами. Проекты и ссылки — каталоги относительно корня репозитория
/// с прямыми слешами: <c>services/gateway</c>, <c>src/ServiceDefaults</c>.
/// </summary>
public static class ProjectReferenceRules
{
    public const string AppHost = "src/AppHost";
    public const string BuildingBlocks = "src/BuildingBlocks";
    public const string Contracts = "src/Contracts";
    public const string ServiceDefaults = "src/ServiceDefaults";

    public static IReadOnlyList<string> FindViolations(IReadOnlyDictionary<string, IReadOnlyList<string>> graph)
    {
        ArgumentNullException.ThrowIfNull(graph);

        var violations = new List<string>();
        foreach (var (project, references) in graph.OrderBy(p => p.Key, StringComparer.Ordinal))
        {
            foreach (var reference in references)
            {
                var reason = Check(project, reference);
                if (reason is not null)
                {
                    violations.Add($"{project} -> {reference}: {reason}");
                }
            }
        }

        return violations;
    }

    private static string? Check(string project, string reference)
    {
        if (IsService(project))
        {
            if (IsService(reference))
            {
                return "a service must not reference another service";
            }

            if (!IsShared(reference))
            {
                return "a service may reference only shared projects in src/ (except AppHost)";
            }

            return null;
        }

        if (IsService(reference) && project != AppHost)
        {
            return "only src/AppHost may reference services";
        }

        if (project == BuildingBlocks && reference == Contracts)
        {
            return "BuildingBlocks has no business meaning and must not reference Contracts (ADR-0008)";
        }

        if (project == ServiceDefaults && reference == BuildingBlocks)
        {
            return "ServiceDefaults is Aspire hosting only and must not reference BuildingBlocks (ADR-0008)";
        }

        return null;
    }

    private static bool IsService(string path) => path.StartsWith("services/", StringComparison.Ordinal);

    private static bool IsShared(string path) => path.StartsWith("src/", StringComparison.Ordinal) && path != AppHost;
}
