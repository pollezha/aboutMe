using Confluent.Kafka;
using Confluent.Kafka.Admin;
using Microsoft.EntityFrameworkCore;
using Projector.Data;

namespace Projector.Projection;

/// <summary>
/// Пересчёт агрегатов из журнала (design §5.5, команда <c>rebuild</c>): сброс офсетов группы на начало и очистка
/// таблиц <c>stats</c>. Следующий запуск projector прочитает топик с начала (<c>auto.offset.reset=earliest</c>).
/// </summary>
public static partial class StatsRebuild
{
    /// <returns>0 — готово; 1 — ошибка (в том числе projector ещё работает: группа активна).</returns>
    public static async Task<int> RunAsync(
        IServiceProvider services, string bootstrapServers, string consumerGroup, ILogger logger, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentException.ThrowIfNullOrEmpty(consumerGroup);

        try
        {
            // Пустая строка подключения "kafka" — ошибка конфигурации: код 1 с записью в лог, а не падение
            ArgumentException.ThrowIfNullOrEmpty(bootstrapServers);

            // Сначала офсеты: если группа активна, данные не трогаем. Если упадёт очистка — повторный запуск
            // безопасен: projector с начала журнала только пропустит уже отмеченные события.
            if (!await ResetGroupAsync(bootstrapServers, consumerGroup, logger))
            {
                return 1;
            }

            await using var scope = services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<StatsDbContext>();
            await TruncateAsync(db, cancellationToken);
            LogDone(logger, consumerGroup);
            return 0;
        }
#pragma warning disable CA1031 // любой сбой → ненулевой код выхода команды
        catch (Exception ex)
#pragma warning restore CA1031
        {
            LogFailed(logger, ex);
            return 1;
        }
    }

    /// <summary>Удаляет группу вместе с её офсетами; Kafka разрешает это только для группы без участников.</summary>
    private static async Task<bool> ResetGroupAsync(string bootstrapServers, string consumerGroup, ILogger logger)
    {
        using var admin = new AdminClientBuilder(new AdminClientConfig { BootstrapServers = bootstrapServers }).Build();
        try
        {
            await admin.DeleteGroupsAsync([consumerGroup]);
            return true;
        }
        catch (DeleteGroupsException ex) when (ex.Results.TrueForAll(r => r.Error.Code == ErrorCode.GroupIdNotFound))
        {
            // Группа ещё ничего не коммитила — сбрасывать нечего
            return true;
        }
        catch (DeleteGroupsException ex) when (ex.Results.Exists(r => r.Error.Code == ErrorCode.NonEmptyGroup))
        {
            LogGroupActive(logger, consumerGroup);
            return false;
        }
    }

    private static Task<int> TruncateAsync(StatsDbContext db, CancellationToken cancellationToken)
    {
        // Все таблицы модели (агрегаты и processed_events); история миграций в модель не входит
        var tables = db.Model.GetEntityTypes()
            .Select(e => $"\"{e.GetSchema()}\".\"{e.GetTableName()}\"")
            .Order(StringComparer.Ordinal);
        var sql = "TRUNCATE " + string.Join(", ", tables);
        return db.Database.ExecuteSqlRawAsync(sql, cancellationToken);
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Stats truncated, offsets of group {ConsumerGroup} reset to the beginning")]
    private static partial void LogDone(ILogger logger, string consumerGroup);

    [LoggerMessage(Level = LogLevel.Error, Message = "Consumer group {ConsumerGroup} is active: stop the projector before rebuild")]
    private static partial void LogGroupActive(ILogger logger, string consumerGroup);

    [LoggerMessage(Level = LogLevel.Error, Message = "Stats rebuild failed")]
    private static partial void LogFailed(ILogger logger, Exception exception);
}
