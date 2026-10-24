using System.Diagnostics;
using System.Text;
using System.Text.Json;
using BuildingBlocks.Messaging.Kafka;
using Confluent.Kafka;
using Contracts;
using Contracts.Events;
using EventsApi.Application.Abstractions;

namespace EventsApi.Infrastructure.Messaging;

/// <summary>
/// Writes events to <see cref="Topics.SiteEvents"/>: key = session hash (keeps a session's order within a
/// partition), value = JSON, headers <c>traceparent</c> and <c>schema-version</c>. The producer comes from the
/// Aspire integration with <see cref="KafkaDefaults"/> (acks=all, idempotence, 2 s delivery timeout).
/// </summary>
public sealed class KafkaEventPublisher(IProducer<string, string> producer) : IEventPublisher
{
    public async Task PublishAsync(SiteEvent siteEvent, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(siteEvent);

        using var activity = KafkaTracePropagation.StartProduceActivity(Topics.SiteEvents);
        var headers = new Headers
        {
            { KafkaHeaders.SchemaVersion, Encoding.UTF8.GetBytes(KafkaHeaders.SchemaVersionValue) },
        };
        KafkaTracePropagation.InjectTraceContext(headers, activity?.Context ?? Activity.Current?.Context ?? default);

        var message = new Message<string, string>
        {
            Key = siteEvent.SessionHash,
            Value = JsonSerializer.Serialize(siteEvent, SiteEventJsonContext.Default.SiteEvent),
            Headers = headers,
        };

        try
        {
            await producer.ProduceAsync(Topics.SiteEvents, message, cancellationToken);
        }
        catch (Exception ex)
        {
            activity?.AddException(ex);
            activity?.SetStatus(ActivityStatusCode.Error);
            throw;
        }
    }
}
