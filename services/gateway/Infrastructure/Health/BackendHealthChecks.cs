using Gateway.Edge.Options;
using Microsoft.Extensions.Options;

namespace Gateway.Infrastructure.Health;

// Проверки по имени бэкенда. Синглтон: кэш результата каждой проверки живёт между запросами /health
internal sealed class BackendHealthChecks(BackendHealthClient client, IOptions<HealthOptions> options)
{
    private readonly Dictionary<string, BackendHealthCheck> checks = options.Value.Backends.ToDictionary(
        backend => backend.Key,
        backend => new BackendHealthCheck(
            client, backend.Value, options.Value.Timeout, options.Value.CacheDuration, TimeProvider.System));

    public BackendHealthCheck this[string name] => checks[name];
}
