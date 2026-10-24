using BuildingBlocks.Messaging.Kafka;
using Contracts.Events;
using LiveHub.Application.ApplyLiveEvent;

namespace LiveHub.Workers;

// Батч из KafkaConsumerLoop (у live-hub — по одному событию) → ApplyLiveEventHandler; изменились счётчики —
// LiveBroadcastWorker разошлёт их на ближайшем тике.
public sealed class LiveEventsMessageHandler(ApplyLiveEventHandler apply, LiveBroadcastWorker broadcaster)
    : IKafkaMessageHandler<SiteEvent>
{
    public async Task HandleAsync(KafkaBatch<SiteEvent> batch, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(batch);

        foreach (var siteEvent in batch.Messages)
        {
            if (await apply.HandleAsync(new ApplyLiveEventCommand(siteEvent), cancellationToken))
            {
                broadcaster.MarkCountersDirty();
            }
        }
    }
}
