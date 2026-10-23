using Microsoft.EntityFrameworkCore;

namespace Projector.Data;

/// <summary>Применение миграций схемы <c>stats</c>: команда <c>migrate</c> и <c>Database:MigrateOnStart</c>.</summary>
public static partial class StatsMigrations
{
    /// <returns>0 — миграции применены (или нечего применять), 1 — ошибка.</returns>
    public static async Task<int> ApplyAsync(IServiceProvider services, ILogger logger, CancellationToken cancellationToken)
    {
        try
        {
            await using var scope = services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<StatsDbContext>();
            await db.Database.MigrateAsync(cancellationToken);
            LogApplied(logger);
            return 0;
        }
#pragma warning disable CA1031 // любой сбой миграции → ненулевой код выхода, процесс не должен падать с трассой
        catch (Exception ex)
#pragma warning restore CA1031
        {
            LogFailed(logger, ex);
            return 1;
        }
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Stats schema migrations applied")]
    private static partial void LogApplied(ILogger logger);

    [LoggerMessage(Level = LogLevel.Error, Message = "Stats schema migration failed")]
    private static partial void LogFailed(ILogger logger, Exception exception);
}
