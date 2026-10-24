// Локальный запуск всего сайта (design §9): одна PostgreSQL (БД content и stats), Kafka KRaft, 5 сервисов.
var builder = DistributedApplication.CreateBuilder(args);

var postgres = builder.AddPostgres("postgres");
var content = postgres.AddDatabase("content");
var stats = postgres.AddDatabase("stats");

// Топик site.events.v1 (3 партиции) создаёт events-api при старте
var kafka = builder.AddKafka("kafka")
    .WithEnvironment("KAFKA_HEAP_OPTS", "-Xmx512m")
    .WithKafkaUI();

// Миграции при старте — только для локального запуска; в проде это отдельный шаг деплоя
var contentApi = builder.AddProject<Projects.ContentApi>("content-api")
    .WithReference(content).WaitFor(content)
    .WithEnvironment("Database__MigrateOnStart", "true")
    .WithEnvironment("Content__Path", Path.GetFullPath(Path.Combine(builder.AppHostDirectory, "..", "..", "content")))
    .WithHttpHealthCheck("/health");

var eventsApi = builder.AddProject<Projects.EventsApi>("events-api")
    .WithReference(kafka).WaitFor(kafka)
    .WithHttpHealthCheck("/health");

var projector = builder.AddProject<Projects.Projector>("projector")
    .WithReference(stats).WaitFor(stats)
    .WithReference(kafka).WaitFor(kafka)
    .WithEnvironment("Database__MigrateOnStart", "true")
    .WithHttpHealthCheck("/health");

var liveHub = builder.AddProject<Projects.LiveHub>("live-hub")
    .WithReference(kafka).WaitFor(kafka)
    .WithHttpHealthCheck("/health");

builder.AddProject<Projects.Gateway>("gateway")
    .WithReference(contentApi).WaitFor(contentApi)
    .WithReference(eventsApi).WaitFor(eventsApi)
    .WithReference(projector).WaitFor(projector)
    .WithReference(liveHub).WaitFor(liveHub)
    .WithEnvironment("Cors__Origins__0", "http://localhost:5173")
    .WithExternalHttpEndpoints()
    .WithHttpHealthCheck("/health");

builder.Build().Run();
