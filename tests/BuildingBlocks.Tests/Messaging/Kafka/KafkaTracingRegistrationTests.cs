using BuildingBlocks.Messaging.Kafka;
using Microsoft.Extensions.DependencyInjection;
using OpenTelemetry.Trace;
using Xunit;

namespace BuildingBlocks.Tests.Messaging.Kafka;

// Слушатели ActivitySource глобальны в процессе: тесты, которые их создают, не идут параллельно.
[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class ActivityListenersGroup
{
    public const string Name = "ActivityListeners";
}

[Collection(ActivityListenersGroup.Name)]
public sealed class KafkaTracingRegistrationTests
{
    // Без AddSource("aboutMe.Kafka") спаны produce/process не попали бы в экспорт.
    [Fact]
    public void AddKafkaTracing_subscribes_tracing_to_the_kafka_activity_source()
    {
        var services = new ServiceCollection();
        services.AddOpenTelemetry().WithTracing(_ => { });
        services.AddKafkaTracing();
        using var provider = services.BuildServiceProvider();

        Assert.Null(KafkaTracePropagation.StartProduceActivity("site.events.v1"));

        _ = provider.GetRequiredService<TracerProvider>();
        using var produce = KafkaTracePropagation.StartProduceActivity("site.events.v1");

        Assert.NotNull(produce);
        Assert.Equal("produce site.events.v1", produce.DisplayName);
    }
}
