using Xunit;

namespace Architecture.Tests;

public sealed class ProjectReferenceRulesTests
{
    private static Dictionary<string, IReadOnlyList<string>> Graph(params (string Project, string[] References)[] projects) =>
        projects.ToDictionary(p => p.Project, p => (IReadOnlyList<string>)p.References);

    [Fact]
    public void Service_referencing_another_service_is_a_violation()
    {
        var violations = ProjectReferenceRules.FindViolations(Graph(
            ("services/a", ["services/b"]),
            ("services/b", [])));

        var violation = Assert.Single(violations, v => v.Contains("services/a -> services/b", StringComparison.Ordinal));
        Assert.Contains("service", violation, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Service_referencing_AppHost_is_a_violation()
    {
        var violations = ProjectReferenceRules.FindViolations(Graph(
            ("services/a", ["src/AppHost"]),
            ("src/AppHost", ["services/a"])));

        Assert.Contains(violations, v => v.Contains("services/a -> src/AppHost", StringComparison.Ordinal));
    }

    [Fact]
    public void Service_referencing_project_outside_src_is_a_violation()
    {
        var violations = ProjectReferenceRules.FindViolations(Graph(
            ("services/a", ["tests/A.Tests"])));

        Assert.Contains(violations, v => v.Contains("services/a -> tests/A.Tests", StringComparison.Ordinal));
    }

    [Fact]
    public void Shared_project_referencing_service_is_a_violation()
    {
        var violations = ProjectReferenceRules.FindViolations(Graph(
            ("src/ServiceDefaults", ["services/a"]),
            ("services/a", ["src/ServiceDefaults"])));

        var violation = Assert.Single(violations);
        Assert.Contains("src/ServiceDefaults -> services/a", violation, StringComparison.Ordinal);
    }

    [Fact]
    public void Allowed_references_produce_no_violations()
    {
        var violations = ProjectReferenceRules.FindViolations(Graph(
            ("services/a", ["src/ServiceDefaults", "src/Contracts"]),
            ("services/b", ["src/ServiceDefaults"]),
            ("src/ServiceDefaults", []),
            ("src/Contracts", []),
            ("src/AppHost", ["services/a", "services/b", "src/ServiceDefaults"])));

        Assert.Empty(violations);
    }

    [Fact]
    public void Repository_projects_follow_reference_rules()
    {
        var graph = RepositoryProjects.LoadGraph(RepositoryProjects.FindRoot());

        Assert.Contains(graph.Keys, p => p.StartsWith("services/", StringComparison.Ordinal));
        Assert.Contains(ProjectReferenceRules.AppHost, graph.Keys);
        Assert.Contains("src/ServiceDefaults", graph.Keys);
        Assert.Contains("services/gateway", graph[ProjectReferenceRules.AppHost]);
        Assert.Empty(ProjectReferenceRules.FindViolations(graph));
    }
}
