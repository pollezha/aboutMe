using Xunit;

namespace Architecture.Tests;

public sealed class LayerRulesTests
{
    private static string NamespaceOf(string fullName) => fullName[..Math.Max(0, fullName.LastIndexOf('.'))];

    private static TypeReferenceInfo Ref(string assembly, string fullName) => new(assembly, NamespaceOf(fullName), fullName);

    private static TypeDependencies Type(string fullName, params TypeReferenceInfo[] references) =>
        new(fullName, NamespaceOf(fullName), references);

    private static IReadOnlyList<string> Check(string service, params TypeDependencies[] types) =>
        LayerRules.FindViolations(new ServiceAssembly(service, types));

    [Fact]
    public void Domain_referencing_only_BCL_Contracts_and_own_Domain_is_allowed()
    {
        var violations = Check("Svc",
            Type("Svc.Domain.Order",
                Ref("System.Runtime", "System.String"),
                Ref("System.Collections.Immutable", "System.Collections.Immutable.ImmutableArray"),
                Ref("Contracts", "Contracts.Events.SiteEvent"),
                Ref("Svc", "Svc.Domain.Rules.Price")),
            Type("Svc.Domain.Rules.Price"));

        Assert.Empty(violations);
    }

    [Theory]
    [InlineData("Microsoft.Extensions.Logging.Abstractions", "Microsoft.Extensions.Logging.ILogger")]
    [InlineData("Svc", "Svc.Application.Abstractions.IOrders")]
    [InlineData("BuildingBlocks", "BuildingBlocks.Persistence.IUnitOfWork")]
    public void Domain_referencing_anything_else_is_a_violation(string assembly, string reference)
    {
        var violations = Check("Svc", Type("Svc.Domain.Order", Ref(assembly, reference)));

        var violation = Assert.Single(violations);
        Assert.Contains($"Svc.Domain.Order -> {reference}", violation, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("Svc", "Svc.Infrastructure.Persistence.OrdersRepository")]
    [InlineData("Svc", "Svc.Api.OrdersEndpoint")]
    [InlineData("Svc", "Svc.Workers.OrdersWorker")]
    [InlineData("Microsoft.AspNetCore.Http.Abstractions", "Microsoft.AspNetCore.Http.HttpContext")]
    [InlineData("Microsoft.EntityFrameworkCore", "Microsoft.EntityFrameworkCore.DbContext")]
    [InlineData("Npgsql", "Npgsql.NpgsqlConnection")]
    [InlineData("Confluent.Kafka", "Confluent.Kafka.IProducer`2")]
    [InlineData("BuildingBlocks", "BuildingBlocks.Http.HttpProblems")]
    [InlineData("BuildingBlocks", "BuildingBlocks.Messaging.Kafka.KafkaDefaults")]
    [InlineData("Microsoft.Extensions.DependencyInjection.Abstractions", "Microsoft.Extensions.DependencyInjection.IServiceCollection")]
    public void Application_referencing_adapters_or_transport_is_a_violation(string assembly, string reference)
    {
        var violations = Check("Svc", Type("Svc.Application.PlaceOrder.PlaceOrderHandler", Ref(assembly, reference)));

        var violation = Assert.Single(violations);
        Assert.Contains($"Svc.Application.PlaceOrder.PlaceOrderHandler -> {reference}", violation, StringComparison.Ordinal);
    }

    [Fact]
    public void Application_referencing_Domain_Contracts_Persistence_and_logging_is_allowed()
    {
        var violations = Check("Svc",
            Type("Svc.Application.PlaceOrder.PlaceOrderHandler",
                Ref("Svc", "Svc.Domain.Order"),
                Ref("Svc", "Svc.Application.Abstractions.IOrders"),
                Ref("Contracts", "Contracts.Events.SiteEvent"),
                Ref("BuildingBlocks", "BuildingBlocks.Persistence.IUnitOfWork"),
                Ref("Microsoft.Extensions.Logging.Abstractions", "Microsoft.Extensions.Logging.ILogger`1"),
                Ref("System.Runtime", "System.Threading.Tasks.Task")),
            Type("Svc.Application.DependencyInjection",
                Ref("Microsoft.Extensions.DependencyInjection.Abstractions", "Microsoft.Extensions.DependencyInjection.IServiceCollection")));

        Assert.Empty(violations);
    }

    [Theory]
    [InlineData("Svc.Api.OrdersEndpoint")]
    [InlineData("Svc.Workers.OrdersWorker")]
    public void Entry_point_referencing_Infrastructure_is_a_violation(string type)
    {
        var violations = Check("Svc", Type(type, Ref("Svc", "Svc.Infrastructure.Persistence.OrdersRepository")));

        var violation = Assert.Single(violations);
        Assert.Contains($"{type} -> Svc.Infrastructure.Persistence.OrdersRepository", violation, StringComparison.Ordinal);
    }

    [Fact]
    public void Composition_root_may_reference_Infrastructure()
    {
        var infrastructure = Ref("Svc", "Svc.Infrastructure.DependencyInjection");

        var violations = Check("Svc",
            new TypeDependencies("Program", "", [infrastructure]),
            Type("Svc.Api.DependencyInjection", infrastructure),
            Type("Svc.Api.OrdersEndpoint",
                Ref("Svc", "Svc.Application.PlaceOrder.PlaceOrderHandler"),
                Ref("Microsoft.AspNetCore.Routing", "Microsoft.AspNetCore.Routing.RouteGroupBuilder"),
                Ref("BuildingBlocks", "BuildingBlocks.Http.HttpProblems")));

        Assert.Empty(violations);
    }

    [Theory]
    [InlineData("Svc.Endpoints.OrdersEndpoint")]
    [InlineData("Svc.ApiHelpers.Helper")]
    [InlineData("Other.Domain.Order")]
    [InlineData("Helper")]
    public void Type_outside_layer_namespaces_is_a_violation(string type)
    {
        var violations = Check("Svc", Type(type));

        var violation = Assert.Single(violations);
        Assert.Contains(type, violation, StringComparison.Ordinal);
    }

    [Fact]
    public void Gateway_has_no_Application_or_Domain_layer()
    {
        var violations = Check("Gateway",
            Type("Gateway.Edge.BotFilter"),
            Type("Gateway.Api.HealthEndpoints"),
            Type("Gateway.Infrastructure.Health.BackendHealthCheck"),
            Type("Gateway.Application.Route"),
            Type("Gateway.Domain.Route"));

        Assert.Equal(2, violations.Count);
        Assert.Contains(violations, v => v.Contains("Gateway.Application.Route", StringComparison.Ordinal));
        Assert.Contains(violations, v => v.Contains("Gateway.Domain.Route", StringComparison.Ordinal));
    }

    [Fact]
    public void Edge_layer_belongs_to_Gateway_only()
    {
        var violations = Check("Svc", Type("Svc.Edge.Filter"));

        Assert.Single(violations);
    }

    [Fact]
    public void All_violations_are_reported()
    {
        var violations = Check("Svc",
            Type("Svc.Application.A.AHandler",
                Ref("Svc", "Svc.Infrastructure.X"),
                Ref("Npgsql", "Npgsql.NpgsqlConnection")),
            Type("Svc.Workers.W", Ref("Svc", "Svc.Infrastructure.Y")));

        Assert.Equal(3, violations.Count);
    }

    public static TheoryData<string> Services() => new(ServiceAssemblies.Projects);

    [Theory]
    [MemberData(nameof(Services))]
    public void Service_assembly_follows_layer_rules(string project)
    {
        var assembly = ServiceAssemblies.Load(RepositoryProjects.FindRoot(), project);

        Assert.NotEmpty(assembly.Types);
        var violations = LayerRules.FindViolations(assembly);
        Assert.True(violations.Count == 0, string.Join(Environment.NewLine, violations));
    }

    [Fact]
    public void Every_service_project_is_checked()
    {
        var root = RepositoryProjects.FindRoot();
        var services = Directory.EnumerateFiles(Path.Combine(root, "services"), "*.csproj", SearchOption.AllDirectories)
            .Select(csproj => Path.GetRelativePath(root, Path.GetDirectoryName(csproj)!).Replace('\\', '/'))
            .Order(StringComparer.Ordinal);

        Assert.Equal(services, ServiceAssemblies.Projects.Order(StringComparer.Ordinal));
    }

    [Fact]
    public void Reader_sees_references_from_signatures_and_method_bodies()
    {
        var assembly = ServiceAssemblies.Load(RepositoryProjects.FindRoot(), "services/content-api");

        var handler = Assert.Single(assembly.Types, t => t.FullName == "ContentApi.Application.GetContent.GetContentHandler");
        // Сигнатура конструктора
        Assert.Contains(handler.References, r => r.FullName == "ContentApi.Application.Abstractions.IContentBundleRepository");
        // Тело метода: вызовы статических членов домена и BCL
        Assert.Contains(handler.References, r => r.FullName == "ContentApi.Domain.ContentBundle");
        Assert.Contains(handler.References, r => r.FullName == "System.String" && r.Assembly == "System.Runtime");

        var infrastructure = Assert.Single(assembly.Types, t => t.FullName == "ContentApi.Infrastructure.DependencyInjection");
        Assert.Contains(infrastructure.References, r => r.Assembly.StartsWith("Microsoft.EntityFrameworkCore", StringComparison.Ordinal));

        // Замыкания, state machine и служебные типы компилятора слиты во внешний тип или пропущены
        Assert.DoesNotContain(assembly.Types, t => t.FullName.Contains('<', StringComparison.Ordinal));

        // file-local тип в корне сборки (Samples/FileLocalSample.cs) — обычный тип: `file class` не обходит правила слоёв
        var self = ServiceAssemblies.LoadFile("Architecture.Tests", typeof(LayerRules).Assembly.Location);
        var fileLocal = Assert.Single(self.Types, t => t.FullName.EndsWith("__FileLocalSample", StringComparison.Ordinal));
        Assert.Equal("Architecture.Tests.Samples", fileLocal.Namespace);
        Assert.Contains(fileLocal.References, r => r.FullName == "Architecture.Tests.LayerRules");
        Assert.Contains(LayerRules.FindViolations(self), v => v.StartsWith(fileLocal.FullName, StringComparison.Ordinal));
    }
}
