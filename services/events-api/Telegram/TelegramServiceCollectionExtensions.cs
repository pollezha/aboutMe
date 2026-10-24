using Microsoft.Extensions.Http.Resilience;
using Microsoft.Extensions.Options;
using OpenTelemetry.Trace;

namespace EventsApi.Telegram;

public static class TelegramServiceCollectionExtensions
{
    /// <summary>
    /// Span redaction of the bot token. Call before <c>AddServiceDefaults()</c>: processors run in registration
    /// order, and the OTLP exporter registered there must see already redacted spans.
    /// </summary>
    public static IServiceCollection AddTelegramSpanRedaction(this IServiceCollection services) =>
        services.ConfigureOpenTelemetryTracerProvider(tracing => tracing.AddProcessor(new TelegramUrlRedactionProcessor()));

    /// <summary>
    /// Typed <see cref="TelegramClient"/>: no HTTP loggers (they would write the URL with the token), the standard
    /// resilience handler replaced by one with 5 s total timeout and 2 retries (design §5.3).
    /// </summary>
    public static IServiceCollection AddTelegramClient(this IServiceCollection services)
    {
        services.AddOptions<TelegramOptions>().BindConfiguration(TelegramOptions.Section);

        var client = services.AddHttpClient<TelegramClient>((serviceProvider, http) =>
            {
                var options = serviceProvider.GetRequiredService<IOptions<TelegramOptions>>().Value;
                if (options.IsConfigured)
                {
                    http.BaseAddress = TelegramClient.BaseAddressFor(options.BotToken!);
                }
            })
            .RemoveAllLoggers();

        // Experimental API, but the only way to replace the handler added by ConfigureHttpClientDefaults
#pragma warning disable EXTEXP0001
        client.RemoveAllResilienceHandlers();
#pragma warning restore EXTEXP0001
        client.AddStandardResilienceHandler(ConfigureResilience);

        return services;
    }

    private static void ConfigureResilience(HttpStandardResilienceOptions options)
    {
        options.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(5);
        options.AttemptTimeout.Timeout = TimeSpan.FromSeconds(2);
        options.Retry.MaxRetryAttempts = 2;
        options.Retry.Delay = TimeSpan.FromMilliseconds(200);
        options.CircuitBreaker.SamplingDuration = TimeSpan.FromSeconds(30);
    }
}
