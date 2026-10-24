using Confluent.Kafka;
using Confluent.Kafka.Admin;
using Contracts;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace EventsApi.Tests;

[Trait("Category", "Integration")]
public sealed class TopicInitializerTests(EmptyKafkaFixture kafka) : IClassFixture<EmptyKafkaFixture>
{
    private static readonly TimeSpan MetadataTimeout = TimeSpan.FromSeconds(10);

    [Fact]
    public async Task Startup_creates_site_events_topic_with_3_partitions_and_year_retention_once()
    {
        var ct = TestContext.Current.CancellationToken;

        // Два старта подряд: второй видит готовый топик и не падает
        foreach (var _ in Enumerable.Range(0, 2))
        {
            using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
                builder.UseSetting("ConnectionStrings:kafka", kafka.BootstrapServers));
            using var client = factory.CreateClient();
            using var response = await client.GetAsync("/alive", ct);
            response.EnsureSuccessStatusCode();
        }

        using var admin = new AdminClientBuilder(new AdminClientConfig { BootstrapServers = kafka.BootstrapServers }).Build();
        var topic = Assert.Single(admin.GetMetadata(MetadataTimeout).Topics, t => t.Topic == Topics.SiteEvents);
        Assert.Equal(ErrorCode.NoError, topic.Error.Code);
        Assert.Equal(3, topic.Partitions.Count);

        var configs = await admin.DescribeConfigsAsync(
            [new ConfigResource { Type = ResourceType.Topic, Name = Topics.SiteEvents }]);
        var retention = Assert.Single(configs).Entries["retention.ms"].Value;
        Assert.Equal(TimeSpan.FromDays(365).TotalMilliseconds.ToString("0", System.Globalization.CultureInfo.InvariantCulture), retention);
    }
}
