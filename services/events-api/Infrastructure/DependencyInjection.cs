using BuildingBlocks.Messaging.Kafka;
using BuildingBlocks.Observability;
using EventsApi.Application.Abstractions;
using EventsApi.Infrastructure.External.Telegram;
using EventsApi.Infrastructure.Messaging;
using EventsApi.Infrastructure.Security;
using Microsoft.Extensions.Http.Resilience;
using Microsoft.Extensions.Options;

namespace EventsApi.Infrastructure;

public static class DependencyInjection
{
    /// <summary>
    /// Span redaction of the Telegram bot token. Call before <c>AddServiceDefaults()</c>: processors run in
    /// registration order, and the OTLP exporter registered there must see already redacted spans.
    /// </summary>
    public static IServiceCollection AddEventsApiSpanRedaction(this IServiceCollection services) =>
        services.AddUrlRedaction(TelegramBotToken.Redact);

    /// <summary>
    /// Adapters: Kafka producer and <see cref="IEventPublisher"/>, topic creation at startup, in-memory daily salt,
    /// Telegram delivery of messages in a bottle.
    /// </summary>
    public static TBuilder AddEventsApiInfrastructure<TBuilder>(this TBuilder builder)
        where TBuilder : IHostApplicationBuilder
    {
        ArgumentNullException.ThrowIfNull(builder);

        // Connection string "kafka" выставляет AppHost; интеграция даёт /health-проверку брокера и метрики.
        // Трейсинг Aspire выключен: спан produce и traceparent пишет общая обёртка KafkaTracePropagation.
        builder.AddKafkaProducer<string, string>("kafka", settings =>
        {
            settings.DisableTracing = true;
            KafkaDefaults.ApplyProducerDefaults(settings.Config);
        });
        builder.Services.AddKafkaTracing();
        builder.Services.AddSingleton<IEventPublisher, KafkaEventPublisher>();
        builder.Services.AddHostedService<TopicInitializer>();

        builder.Services.AddSingleton<IDailySalt, InMemoryDailySalt>();

        builder.Services.AddTelegramDelivery();
        return builder;
    }

    /// <summary>
    /// Typed <see cref="TelegramContactMessageDelivery"/>: no HTTP loggers (they would write the URL with the token),
    /// the standard resilience handler replaced by one with 5 s total timeout and 2 retries (design §5.3).
    /// </summary>
    private static void AddTelegramDelivery(this IServiceCollection services)
    {
        services.AddOptions<TelegramOptions>().BindConfiguration(TelegramOptions.Section);

        var client = services.AddHttpClient<TelegramContactMessageDelivery>((serviceProvider, http) =>
            {
                var options = serviceProvider.GetRequiredService<IOptions<TelegramOptions>>().Value;
                if (options.IsConfigured)
                {
                    http.BaseAddress = TelegramBotToken.BaseAddressFor(options.BotToken!);
                }
            })
            .RemoveAllLoggers();

        // Experimental API, but the only way to replace the handler added by ConfigureHttpClientDefaults
#pragma warning disable EXTEXP0001
        client.RemoveAllResilienceHandlers();
#pragma warning restore EXTEXP0001
        client.AddStandardResilienceHandler(ConfigureResilience);

        services.AddTransient<IContactMessageDelivery>(sp => sp.GetRequiredService<TelegramContactMessageDelivery>());
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
