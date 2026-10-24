using System.Diagnostics.Metrics;

namespace Projector.Projection;

/// <summary>
/// Метрика <c>events_poison_total</c>: сообщения, которые не десериализуются в событие. Такое сообщение
/// пропускается — его офсет коммитится вместе с батчем (DLQ в MVP нет, design §5.5).
/// </summary>
public sealed class PoisonCounter
{
    public const string MeterName = "aboutMe.Projector";
    public const string InstrumentName = "events_poison_total";

    private readonly Counter<long> _counter;

    public PoisonCounter(IMeterFactory meterFactory)
    {
        ArgumentNullException.ThrowIfNull(meterFactory);

        var meter = meterFactory.Create(MeterName);
        _counter = meter.CreateCounter<long>(
            InstrumentName, unit: "{message}", description: "Kafka messages that are not a valid site event and were skipped");
    }

    public void Add() => _counter.Add(1);
}
