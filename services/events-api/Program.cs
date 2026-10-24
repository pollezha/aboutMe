using Contracts.Events;
using EventsApi;
using EventsApi.Endpoints;
using EventsApi.Telegram;
using Microsoft.Extensions.DependencyInjection.Extensions;
using ServiceDefaults.Kafka;

var builder = WebApplication.CreateBuilder(args);

// До AddServiceDefaults: редактор токена должен стоять в конвейере спанов раньше OTLP-экспортёра
builder.Services.AddTelegramSpanRedaction();
builder.AddServiceDefaults();

// Connection string "kafka" выставляет AppHost; интеграция даёт /health-проверку брокера и метрики.
// Трейсинг Aspire выключен: спан produce и traceparent пишет общая обёртка KafkaTracePropagation.
builder.AddKafkaProducer<string, string>("kafka", settings =>
{
    settings.DisableTracing = true;
    KafkaDefaults.ApplyProducerDefaults(settings.Config);
});

builder.Services.AddProblemDetails();
builder.Services.TryAddSingleton(TimeProvider.System);
builder.Services.AddSingleton<EventValidator>();
builder.Services.AddSingleton<Anonymizer>();
builder.Services.AddSingleton<IEventProducer, KafkaEventProducer>();
builder.Services.AddHostedService<TopicInitializer>();
builder.Services.AddTelegramClient();

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();

app.MapDefaultEndpoints();
app.MapEventsEndpoints();
app.MapMessagesEndpoints();

app.Run();
