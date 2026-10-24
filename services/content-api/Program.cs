using ContentApi.Data;
using ContentApi.Endpoints;
using ContentApi.Seeding;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

// Строка подключения "content" приходит из AppHost; интеграция Aspire добавляет health check БД и OTel
builder.AddNpgsqlDbContext<ContentDbContext>(
    ContentDbContext.ConnectionName,
    configureDbContextOptions: options => options.UseNpgsql(ContentDbContext.ConfigureNpgsql));

// Сид из content/{en,ru}.json при старте; результат виден в /health как проверка "content"
builder.Services.AddSingleton<ContentSeedState>();
builder.Services.AddHostedService<ContentSeeder>();
builder.Services.AddHealthChecks().AddCheck<ContentSeedHealthCheck>(ContentSeedHealthCheck.Name);

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
app.MapContentEndpoints();

await app.RunAsync();
return 0;
