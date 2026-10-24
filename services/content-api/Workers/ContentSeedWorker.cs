using ContentApi.Application.Abstractions;
using ContentApi.Application.SeedContent;
using ContentApi.Domain;

namespace ContentApi.Workers;

/// <summary>
/// При старте (до приёма запросов) сидит бандлы <c>{en,ru}.json</c> (docs/design/architecture.md §5.7). Любая
/// ошибка не роняет процесс: <c>/health</c> становится Unhealthy с описанием, <c>/alive</c> отвечает.
/// </summary>
public sealed partial class ContentSeedWorker(
    IServiceScopeFactory scopeFactory,
    IContentSeedState state,
    ILogger<ContentSeedWorker> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        SeedContentResult result;
        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var handler = scope.ServiceProvider.GetRequiredService<SeedContentHandler>();
            result = await handler.HandleAsync(new SeedContentCommand(ContentBundle.SupportedLangs), cancellationToken);
        }
#pragma warning disable CA1031 // недоступная БД, незаполненная схема или нет папки content → Unhealthy, а не падение процесса
        catch (Exception ex) when (ex is not OperationCanceledException)
#pragma warning restore CA1031
        {
            LogStoreFailed(logger, ex);
            state.Failed($"Content seeding failed: {ex.Message}");
            return;
        }

        switch (result)
        {
            case SeedContentResult.Seeded seeded:
                foreach (var b in seeded.Bundles)
                {
                    LogSeeded(logger, b.Lang, b.ContentVersion, b.VersionHash, b.Changed);
                }

                state.Succeeded(string.Join(", ", seeded.Bundles.Select(b => $"{b.Lang} {b.ContentVersion}")));
                break;
            case SeedContentResult.Failed failed:
                foreach (var error in failed.Errors)
                {
                    LogInvalid(logger, error);
                }

                state.Failed($"Invalid content: {string.Join("; ", failed.Errors)}");
                break;
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    [LoggerMessage(Level = LogLevel.Error, Message = "Content bundle rejected: {Error}")]
    private static partial void LogInvalid(ILogger logger, string error);

    [LoggerMessage(Level = LogLevel.Error, Message = "Content bundles could not be stored")]
    private static partial void LogStoreFailed(ILogger logger, Exception exception);

    [LoggerMessage(Level = LogLevel.Information,
        Message = "Content bundle {Lang} {ContentVersion} ({VersionHash}) seeded, changed: {Changed}")]
    private static partial void LogSeeded(ILogger logger, string lang, string contentVersion, string versionHash, bool changed);
}
