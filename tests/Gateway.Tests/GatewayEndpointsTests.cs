using System.Net;
using Xunit;

namespace Gateway.Tests;

public sealed class GatewayEndpointsTests
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Alive_returns_200_for_any_host_without_calling_backends()
    {
        await using var factory = new GatewayFactory();
        factory.Backends.Respond("content-api", _ => new HttpResponseMessage(HttpStatusCode.ServiceUnavailable));
        using var request = new HttpRequestMessage(HttpMethod.Get, "/alive") { Headers = { Host = "api.example.com" } };

        var response = await factory.CreateClient().SendAsync(request, Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(0, factory.Backends.CallsTo("content-api"));
    }

    [Fact]
    public async Task Health_from_external_host_returns_404()
    {
        await using var factory = new GatewayFactory();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/health") { Headers = { Host = "api.example.com" } };

        var response = await factory.CreateClient().SendAsync(request, Ct);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(0, factory.Backends.CallsTo("content-api"));
    }

    [Theory]
    [InlineData("localhost")]
    [InlineData("gateway:8080")]
    [InlineData("127.0.0.1")]
    public async Task Health_from_allowed_host_returns_200_when_backends_are_healthy(string host)
    {
        await using var factory = new GatewayFactory();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/health") { Headers = { Host = host } };

        var response = await factory.CreateClient().SendAsync(request, Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1, factory.Backends.CallsTo("content-api"));
        Assert.Equal(1, factory.Backends.CallsTo("events-api"));
        Assert.Equal(1, factory.Backends.CallsTo("live-hub"));
        Assert.Equal(1, factory.Backends.CallsTo("projector"));
    }

    [Fact]
    public async Task Health_returns_503_when_a_backend_is_down()
    {
        await using var factory = new GatewayFactory();
        factory.Backends.Respond("projector", _ => new HttpResponseMessage(HttpStatusCode.ServiceUnavailable));

        var response = await factory.CreateClient().GetAsync("/health", Ct);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal(1, factory.Backends.CallsTo("projector"));
    }

    [Fact]
    public async Task Health_returns_503_when_a_backend_does_not_answer_in_time()
    {
        await using var factory = new GatewayFactory(new Dictionary<string, string?> { ["Health:Timeout"] = "00:00:00.200" });
        factory.Backends.Respond("live-hub", async (_, ct) =>
        {
            await Task.Delay(TimeSpan.FromSeconds(10), ct);
            return new HttpResponseMessage(HttpStatusCode.OK);
        });

        var response = await factory.CreateClient().GetAsync("/health", Ct);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
    }

    [Fact]
    public async Task Health_result_of_backends_is_cached()
    {
        await using var factory = new GatewayFactory();
        var client = factory.CreateClient();

        await client.GetAsync("/health", Ct);
        var second = await client.GetAsync("/health", Ct);

        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        Assert.Equal(1, factory.Backends.CallsTo("content-api"));
    }

    [Fact]
    public async Task Unknown_api_route_returns_404()
    {
        await using var factory = new GatewayFactory();

        var response = await factory.CreateClient().GetAsync("/api/unknown", Ct);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
