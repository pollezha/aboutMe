using System.Diagnostics;
using System.Globalization;
using System.Text;
using Confluent.Kafka;
using OpenTelemetry;
using OpenTelemetry.Context.Propagation;

namespace ServiceDefaults.Kafka;

// Confluent.Kafka не создаёт спаны сам. Здесь — один код для продюсера (events-api) и консьюмеров
// (projector, live-hub): спаны produce/process и проброс traceparent/tracestate/baggage через заголовки
// сообщения (docs/design/architecture.md §6). Пропагатор — Propagators.DefaultTextMapPropagator: его
// выставляет OpenTelemetry SDK (AddServiceDefaults), без SDK он no-op и заголовки не пишутся.
public static class KafkaTracePropagation
{
    public const string ActivitySourceName = "aboutMe.Kafka";

    private static readonly ActivitySource Source = new(ActivitySourceName);

    // Спан отправки; null, если источник никто не слушает (трейсинг выключен).
    public static Activity? StartProduceActivity(string topic)
    {
        ArgumentException.ThrowIfNullOrEmpty(topic);

        var activity = Source.StartActivity($"produce {topic}", ActivityKind.Producer);
        SetMessagingTags(activity, topic, "publish");
        return activity;
    }

    // Пишет контекст в заголовки сообщения; невалидный (default) контекст не пишется.
    public static void InjectTraceContext(Headers headers, ActivityContext context)
    {
        ArgumentNullException.ThrowIfNull(headers);

        Propagators.DefaultTextMapPropagator.Inject(
            new PropagationContext(context, Baggage.Current),
            headers,
            static (carrier, key, value) =>
            {
                carrier.Remove(key);
                carrier.Add(key, Encoding.UTF8.GetBytes(value));
            });
    }

    // Родительский контекст из заголовков; default, если заголовков нет или они битые.
    public static PropagationContext ExtractTraceContext(Headers? headers) =>
        headers is null
            ? default
            : Propagators.DefaultTextMapPropagator.Extract(default, headers, static (carrier, key) =>
                carrier.TryGetLastBytes(key, out var bytes) ? [Encoding.UTF8.GetString(bytes)] : []);

    // Спан обработки сообщения — дочерний к спану produce из заголовков. Без заголовков — новый корневой
    // трейс (при условии, что цикл консьюмера не работает внутри чужого Activity.Current).
    public static Activity? StartProcessActivity<TKey, TValue>(ConsumeResult<TKey, TValue> result)
    {
        ArgumentNullException.ThrowIfNull(result);

        var parent = ExtractTraceContext(result.Message?.Headers);
        Baggage.Current = parent.Baggage;

        var activity = Source.StartActivity($"process {result.Topic}", ActivityKind.Consumer, parent.ActivityContext);
        SetMessagingTags(activity, result.Topic, "process");
        if (activity is { IsAllDataRequested: true })
        {
            activity.SetTag("messaging.destination.partition.id", result.Partition.Value.ToString(CultureInfo.InvariantCulture));
            activity.SetTag("messaging.kafka.message.offset", result.Offset.Value);
        }

        return activity;
    }

    private static void SetMessagingTags(Activity? activity, string topic, string operation)
    {
        if (activity is not { IsAllDataRequested: true })
        {
            return;
        }

        activity.SetTag("messaging.system", "kafka");
        activity.SetTag("messaging.destination.name", topic);
        activity.SetTag("messaging.operation", operation);
    }
}
