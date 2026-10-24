using ContentApi.Api;
using ContentApi.Application;
using ContentApi.Infrastructure;
using ContentApi.Infrastructure.Persistence;
using ContentApi.Workers;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
builder.Services.AddContentApiApplication();
builder.AddContentApiInfrastructure();

// Сид из content/{en,ru}.json при старте; результат виден в /health как проверка "content"
builder.Services.AddHostedService<ContentSeedWorker>();

builder.Services.AddProblemDetails();
builder.Services.AddContentOutputCache();

var app = builder.Build();

// `dotnet run --project services/content-api -- migrate`: применить миграции и выйти (шаг деплоя)
if (args.Contains("migrate", StringComparer.Ordinal))
{
    return await ContentMigrations.ApplyAsync(app.Services, app.Logger, CancellationToken.None);
}

// Только для локального запуска из AppHost; в проде миграции — отдельный шаг деплоя
if (app.Configuration.GetValue<bool>("Database:MigrateOnStart"))
{
    var exitCode = await ContentMigrations.ApplyAsync(app.Services, app.Logger, CancellationToken.None);
    if (exitCode != 0)
    {
        return exitCode;
    }
}

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseOutputCache();

app.MapDefaultEndpoints();
app.MapContentEndpoint();

await app.RunAsync();
return 0;
