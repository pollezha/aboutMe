using Projector.Application;
using Projector.Application.RebuildStats;
using Projector.Infrastructure;
using Projector.Infrastructure.Persistence;
using Projector.Workers;

var builder = WebApplication.CreateBuilder(args);

var projectorOptions = builder.Configuration.GetSection(ProjectorOptions.SectionName).Get<ProjectorOptions>()
    ?? new ProjectorOptions();

builder.AddServiceDefaults();
builder.Services.AddProjectorApplication();
builder.AddProjectorInfrastructure(projectorOptions.ConsumerGroup);

builder.Services.AddSingleton(projectorOptions);
builder.Services.AddHostedService<ProjectorWorker>();

var app = builder.Build();

// `dotnet run --project services/projector -- migrate`: применить миграции и выйти (шаг деплоя)
if (args.Contains("migrate", StringComparer.Ordinal))
{
    return await StatsMigrations.ApplyAsync(app.Services, app.Logger, CancellationToken.None);
}

// `dotnet run --project services/projector -- rebuild`: пересчёт агрегатов из журнала; projector должен быть остановлен
if (args.Contains("rebuild", StringComparer.Ordinal))
{
    return await RebuildAsync(app.Services, projectorOptions.ConsumerGroup, app.Logger);
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

// 0 — готово; 1 — ошибка (в том числе projector ещё работает: группа активна)
static async Task<int> RebuildAsync(IServiceProvider services, string consumerGroup, ILogger logger)
{
    try
    {
        await using var scope = services.CreateAsyncScope();
        var handler = scope.ServiceProvider.GetRequiredService<RebuildStatsHandler>();
        var result = await handler.HandleAsync(new RebuildStatsCommand(consumerGroup), CancellationToken.None);
        if (result == RebuildStatsResult.GroupActive)
        {
            ProgramLog.RebuildGroupActive(logger, consumerGroup);
            return 1;
        }

        ProgramLog.RebuildDone(logger, consumerGroup);
        return 0;
    }
#pragma warning disable CA1031 // любой сбой → ненулевой код выхода команды
    catch (Exception ex)
#pragma warning restore CA1031
    {
        ProgramLog.RebuildFailed(logger, ex);
        return 1;
    }
}

internal static partial class ProgramLog
{
    [LoggerMessage(Level = LogLevel.Information, Message = "Stats truncated, offsets of group {ConsumerGroup} reset to the beginning")]
    public static partial void RebuildDone(ILogger logger, string consumerGroup);

    [LoggerMessage(Level = LogLevel.Error, Message = "Consumer group {ConsumerGroup} is active: stop the projector before rebuild")]
    public static partial void RebuildGroupActive(ILogger logger, string consumerGroup);

    [LoggerMessage(Level = LogLevel.Error, Message = "Stats rebuild failed")]
    public static partial void RebuildFailed(ILogger logger, Exception exception);
}
