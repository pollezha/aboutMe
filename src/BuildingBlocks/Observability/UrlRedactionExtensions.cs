using Microsoft.Extensions.DependencyInjection;
using OpenTelemetry.Trace;

namespace BuildingBlocks.Observability;

public static class UrlRedactionExtensions
{
    /// <summary>
    /// Registers <see cref="UrlRedactionProcessor"/>. Call before <c>AddServiceDefaults()</c>: processors run in
    /// registration order, and the OTLP exporter registered there must see already redacted spans.
    /// </summary>
    public static IServiceCollection AddUrlRedaction(this IServiceCollection services, Func<string, string> redact)
    {
        ArgumentNullException.ThrowIfNull(redact);
        return services.ConfigureOpenTelemetryTracerProvider(tracing => tracing.AddProcessor(new UrlRedactionProcessor(redact)));
    }
}
