using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using OpenTelemetry.Trace;
using ServiceDefaults.Kafka;
using Xunit;

namespace ServiceDefaults.Tests;

// Слушатели ActivitySource глобальны в процессе: тесты, которые их создают, не идут параллельно.
[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class ActivityListenersGroup
{
    public const string Name = "ActivityListeners";
}

[Collection(ActivityListenersGroup.Name)]
public sealed class KafkaTelemetryRegistrationTests
{
    // Без AddSource("aboutMe.Kafka") в ServiceDefaults спаны produce/process не попали бы в экспорт.
    [Fact]
    public void AddServiceDefaults_subscribes_tracing_to_the_kafka_activity_source()
    {
        var builder = Host.CreateApplicationBuilder();
        builder.AddServiceDefaults();
        using var host = builder.Build();

        Assert.Null(KafkaTracePropagation.StartProduceActivity("site.events.v1"));

        _ = host.Services.GetRequiredService<TracerProvider>();
        using var produce = KafkaTracePropagation.StartProduceActivity("site.events.v1");

        Assert.NotNull(produce);
        Assert.Equal("produce site.events.v1", produce.DisplayName);
    }
}
