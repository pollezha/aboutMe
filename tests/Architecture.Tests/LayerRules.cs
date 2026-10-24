namespace Architecture.Tests;

/// <summary>Тип, на который ссылается код: сборка, где он объявлен, namespace и полное имя.</summary>
public sealed record TypeReferenceInfo(string Assembly, string Namespace, string FullName);

/// <summary>Тип сборки сервиса (вложенные и сгенерированные компилятором типы слиты во внешний) и всё, на что он ссылается.</summary>
public sealed record TypeDependencies(string FullName, string Namespace, IReadOnlyList<TypeReferenceInfo> References);

/// <summary>Скомпилированная сборка сервиса: имя сборки = корневой namespace (<c>ContentApi</c>).</summary>
public sealed record ServiceAssembly(string Name, IReadOnlyList<TypeDependencies> Types);

/// <summary>
/// Правила слоёв ADR-0007 внутри сборки сервиса. Слой — второй сегмент namespace: <c>&lt;Svc&gt;.&lt;Layer&gt;[.&lt;Feature&gt;]</c>.
/// </summary>
public static class LayerRules
{
    public const string Api = "Api";
    public const string Application = "Application";
    public const string Domain = "Domain";
    public const string Edge = "Edge";
    public const string Infrastructure = "Infrastructure";
    public const string Workers = "Workers";

    private const string Gateway = "Gateway";
    private const string Contracts = "Contracts";
    private const string BuildingBlocks = "BuildingBlocks";
    private const string CompositionRoot = "Program";
    private const string DependencyInjection = "DependencyInjection";

    /// <summary>Сборки адаптеров и транспорта, о которых не знает Application.</summary>
    private static readonly string[] ApplicationForbiddenAssemblies =
        ["Microsoft.AspNetCore", "Microsoft.EntityFrameworkCore", "Npgsql", "Confluent.Kafka"];

    /// <summary>Строительные блоки транспорта (HTTP, Kafka) — только для точек входа и адаптеров.</summary>
    private static readonly string[] ApplicationForbiddenBuildingBlocks =
        ["BuildingBlocks.Http", "BuildingBlocks.Messaging"];

    /// <summary>Регистрация в DI — только в <c>Application.DependencyInjection</c>.</summary>
    private static readonly string[] CompositionAssemblies =
        ["Microsoft.Extensions.DependencyInjection", "Microsoft.Extensions.Hosting"];

    /// <summary>Gateway — маршруты и политики без домена: слоёв Application/Domain нет осознанно.</summary>
    public static IReadOnlyList<string> LayersOf(string service) =>
        service == Gateway
            ? [Api, Edge, Infrastructure]
            : [Api, Application, Domain, Infrastructure, Workers];

    public static IReadOnlyList<string> FindViolations(ServiceAssembly assembly)
    {
        ArgumentNullException.ThrowIfNull(assembly);

        var layers = LayersOf(assembly.Name);
        var violations = new List<string>();
        foreach (var type in assembly.Types.OrderBy(t => t.FullName, StringComparer.Ordinal))
        {
            if (type.FullName == CompositionRoot)
            {
                continue;
            }

            var layer = LayerOf(assembly.Name, type.Namespace);
            if (layer is null || !layers.Contains(layer))
            {
                violations.Add($"{type.FullName}: namespace must be {assembly.Name}.{{{string.Join('|', layers)}}}[.*] (ADR-0007)");
                continue;
            }

            foreach (var reference in type.References.Distinct().OrderBy(r => r.FullName, StringComparer.Ordinal))
            {
                var reason = Check(assembly.Name, type, layer, reference);
                if (reason is not null)
                {
                    violations.Add($"{type.FullName} -> {reference.FullName} [{reference.Assembly}]: {reason}");
                }
            }
        }

        return violations;
    }

    private static string? Check(string service, TypeDependencies type, string layer, TypeReferenceInfo reference)
    {
        var own = reference.Assembly == service;
        var referencedLayer = own ? LayerOf(service, reference.Namespace) : null;

        switch (layer)
        {
            case Domain:
                if (own ? referencedLayer != Domain : !IsBcl(reference.Assembly) && reference.Assembly != Contracts)
                {
                    return "Domain may reference only BCL, Contracts and its own Domain";
                }

                return null;

            case Application:
                if (referencedLayer is Infrastructure or Api or Workers)
                {
                    return $"Application must not reference {referencedLayer}";
                }

                if (ApplicationForbiddenAssemblies.Any(a => IsAssemblyFamily(reference.Assembly, a)))
                {
                    return "Application must not reference ASP.NET Core, EF Core, Npgsql or Kafka";
                }

                if (reference.Assembly == BuildingBlocks && ApplicationForbiddenBuildingBlocks.Any(n => IsNamespaceFamily(reference.Namespace, n)))
                {
                    return "Application must not reference transport building blocks (Http, Messaging)";
                }

                if (CompositionAssemblies.Any(a => IsAssemblyFamily(reference.Assembly, a)) && !IsDependencyInjection(type))
                {
                    return $"only {service}.Application.{DependencyInjection} may reference DI/hosting";
                }

                return null;

            case Api or Workers:
                if (referencedLayer == Infrastructure && !IsDependencyInjection(type))
                {
                    return $"{layer} must not reference Infrastructure (only Program and DependencyInjection may)";
                }

                return null;

            default:
                return null;
        }
    }

    /// <summary>Слой по namespace (<c>Svc.Application.X</c> → <c>Application</c>), <c>null</c> — вне корня сервиса.</summary>
    private static string? LayerOf(string service, string ns)
    {
        if (!ns.StartsWith(service + ".", StringComparison.Ordinal))
        {
            return null;
        }

        var rest = ns[(service.Length + 1)..];
        var dot = rest.IndexOf('.', StringComparison.Ordinal);
        return dot < 0 ? rest : rest[..dot];
    }

    private static bool IsDependencyInjection(TypeDependencies type) =>
        type.FullName.EndsWith("." + DependencyInjection, StringComparison.Ordinal);

    private static bool IsBcl(string assembly) =>
        assembly is "System" or "mscorlib" or "netstandard" || assembly.StartsWith("System.", StringComparison.Ordinal);

    private static bool IsAssemblyFamily(string assembly, string family) =>
        assembly == family || assembly.StartsWith(family + ".", StringComparison.Ordinal);

    private static bool IsNamespaceFamily(string ns, string family) =>
        ns == family || ns.StartsWith(family + ".", StringComparison.Ordinal);
}
