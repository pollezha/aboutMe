using System.Diagnostics;
using BuildingBlocks.Persistence;
using Projector.Application.Abstractions;
using Projector.Domain;

namespace Projector.Application.ProjectEvents;

/// <summary>
/// Проекция батча в одной транзакции: отметки <c>processed_events</c> и приращения агрегатов только для событий,
/// которых ещё не было (ADR-0002, design §5.5). Повторная доставка ⇒ событие не новое ⇒ агрегат не меняется.
/// Исключение ⇒ транзакция не зафиксирована (откат при освобождении unit of work вместе со scope).
/// </summary>
public sealed class ProjectEventsHandler(
    IUnitOfWork unitOfWork, IProcessedEventsRepository processedEvents, IStatsRepository stats)
{
    /// <returns>Число новых (ранее не обработанных) событий.</returns>
    public async Task<int> HandleAsync(ProjectEventsCommand command, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        if (command.Events.Count == 0)
        {
            return 0;
        }

        using var activity = ProjectorTelemetry.Source.StartActivity(
            "project batch", ActivityKind.Internal, parentContext: default, links: command.Links);
        activity?.SetTag("messaging.batch.message_count", command.Events.Count);
        try
        {
            // Дубль внутри одного батча тоже считается один раз
            var unique = command.Events.DistinctBy(e => e.EventId).ToList();

            await unitOfWork.BeginAsync(cancellationToken);
            var fresh = await processedEvents.MarkProcessedAsync([.. unique.Select(e => e.EventId)], cancellationToken);
            var deltas = Aggregator.Aggregate(unique.Where(e => fresh.Contains(e.EventId)));
            if (deltas.Count > 0)
            {
                await stats.ApplyDeltasAsync(deltas, cancellationToken);
            }

            await unitOfWork.CommitAsync(cancellationToken);
            activity?.SetTag("projector.events.new", fresh.Count);
            return fresh.Count;
        }
        catch (Exception ex)
        {
            activity?.SetStatus(ActivityStatusCode.Error, ex.GetType().Name);
            throw;
        }
    }
}
