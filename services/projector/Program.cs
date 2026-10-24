using Microsoft.EntityFrameworkCore;
using Projector.Data;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

// Строка подключения "stats" приходит из AppHost; интеграция Aspire добавляет health check БД и OTel
builder.AddNpgsqlDbContext<StatsDbContext>(
    StatsDbContext.ConnectionName,
    configureDbContextOptions: options => options.UseNpgsql(StatsDbContext.ConfigureNpgsql));

var app = builder.Build();

// `dotnet run --project services/projector -- migrate`: применить миграции и выйти (шаг деплоя)
if (args.Contains("migrate", StringComparer.Ordinal))
{
    return await StatsMigrations.ApplyAsync(app.Services, app.Logger, CancellationToken.None);
}

// Только для локального запуска из AppHost; в проде миграции — отдельный шаг деплоя
if (app.Configuration.GetValue<bool>("Database:MigrateOnStart"))
{
    var exitCode = await StatsMigrations.ApplyAsync(app.Services, app.Logger, CancellationToken.None);
    if (exitCode != 0)
    {
        return exitCode;
    }
}

app.MapDefaultEndpoints();

await app.RunAsync();
return 0;
