using System.Net;
using System.Net.Http.Headers;
using System.Text;
using Xunit;

namespace Gateway.Tests;

public sealed class ProxyPoliciesTests
{
    private const string SiteOrigin = "https://site.example";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static StringContent EventBody(int bytes = 64) =>
        new("{\"x\":\"" + new string('a', Math.Max(0, bytes - 8)) + "\"}", Encoding.UTF8, "application/json");

    private static HttpRequestMessage PostEvent(string? forwardedFor = null, string? remoteIp = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/events") { Content = EventBody() };
        if (forwardedFor is not null)
        {
            request.Headers.Add("X-Forwarded-For", forwardedFor);
        }

        if (remoteIp is not null)
        {
            request.Headers.Add(GatewayFactory.RemoteIpHeader, remoteIp);
        }

        return request;
    }

    [Fact]
    public async Task Content_is_proxied_to_content_api_with_etag_preserved()
    {
        await using var factory = new GatewayFactory();
        string? backendPath = null;
        factory.Backends.Respond("content-api", request =>
        {
            backendPath = request.RequestUri!.PathAndQuery;
            var response = new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{}", Encoding.UTF8, "application/json") };
            response.Headers.ETag = new EntityTagHeaderValue("\"v42\"");
            return response;
        });

        var result = await factory.CreateClient().GetAsync("/api/content/en", Ct);

        Assert.Equal(HttpStatusCode.OK, result.StatusCode);
        Assert.Equal("/api/content/en", backendPath);
        Assert.Equal("\"v42\"", result.Headers.ETag?.Tag);
    }

    [Theory]
    [InlineData("/api/events", "events-api")]
    [InlineData("/api/messages", "events-api")]
    [InlineData("/hubs/live/negotiate", "live-hub")]
    public async Task Post_routes_are_proxied_to_their_backend(string path, string backend)
    {
        await using var factory = new GatewayFactory();
        factory.Backends.Respond(backend, _ => new HttpResponseMessage(HttpStatusCode.Accepted));

        var response = await factory.CreateClient().PostAsync(path, EventBody(), Ct);

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Equal(1, factory.Backends.CallsTo(backend));
    }

    [Fact]
    public async Task Get_on_events_route_is_not_proxied()
    {
        await using var factory = new GatewayFactory();

        var response = await factory.CreateClient().GetAsync("/api/events", Ct);

        Assert.Equal(HttpStatusCode.MethodNotAllowed, response.StatusCode);
        Assert.Equal(0, factory.Backends.CallsTo("events-api"));
    }

    [Fact]
    public async Task Sixty_first_event_in_a_minute_from_one_ip_gets_429_problem_with_retry_after()
    {
        await using var factory = new GatewayFactory();
        var client = factory.CreateClient();

        for (var i = 0; i < 60; i++)
        {
            using var request = PostEvent();
            var ok = await client.SendAsync(request, Ct);
            Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        }

        using var last = PostEvent();
        var rejected = await client.SendAsync(last, Ct);

        Assert.Equal(HttpStatusCode.TooManyRequests, rejected.StatusCode);
        Assert.NotNull(rejected.Headers.RetryAfter?.Delta);
        Assert.True(rejected.Headers.RetryAfter!.Delta > TimeSpan.Zero);
        Assert.Equal("application/problem+json", rejected.Content.Headers.ContentType?.MediaType);
        Assert.Equal(60, factory.Backends.CallsTo("events-api"));
    }

    [Fact]
    public async Task Event_limit_is_counted_per_client_ip()
    {
        await using var factory = new GatewayFactory(new Dictionary<string, string?> { ["RateLimits:Events:PermitLimit"] = "2" });
        var client = factory.CreateClient();

        for (var i = 0; i < 2; i++)
        {
            using var request = PostEvent();
            await client.SendAsync(request, Ct);
        }

        using var otherClient = PostEvent(remoteIp: "198.51.100.7");
        var response = await client.SendAsync(otherClient, Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Forwarded_for_from_unknown_proxy_is_ignored_for_rate_limit()
    {
        await using var factory = new GatewayFactory(new Dictionary<string, string?> { ["RateLimits:Events:PermitLimit"] = "2" });
        var client = factory.CreateClient();
        var statuses = new List<HttpStatusCode>();

        for (var i = 1; i <= 3; i++)
        {
            using var request = PostEvent(forwardedFor: $"192.0.2.{i}");
            statuses.Add((await client.SendAsync(request, Ct)).StatusCode);
        }

        Assert.Equal([HttpStatusCode.OK, HttpStatusCode.OK, HttpStatusCode.TooManyRequests], statuses);
    }

    [Fact]
    public async Task Forwarded_for_from_known_proxy_is_used_for_rate_limit()
    {
        await using var factory = new GatewayFactory(new Dictionary<string, string?>
        {
            ["RateLimits:Events:PermitLimit"] = "2",
            ["ForwardedHeaders:KnownProxies:0"] = GatewayFactory.DefaultRemoteIp.ToString(),
        });
        var client = factory.CreateClient();

        for (var i = 1; i <= 3; i++)
        {
            using var request = PostEvent(forwardedFor: $"192.0.2.{i}");
            Assert.Equal(HttpStatusCode.OK, (await client.SendAsync(request, Ct)).StatusCode);
        }
    }

    [Fact]
    public async Task Fourth_message_in_an_hour_gets_429()
    {
        await using var factory = new GatewayFactory();
        var client = factory.CreateClient();
        var statuses = new List<HttpStatusCode>();

        for (var i = 0; i < 4; i++)
        {
            statuses.Add((await client.PostAsync("/api/messages", EventBody(), Ct)).StatusCode);
        }

        Assert.Equal([HttpStatusCode.OK, HttpStatusCode.OK, HttpStatusCode.OK, HttpStatusCode.TooManyRequests], statuses);
    }

    [Fact]
    public async Task Fourth_concurrent_hub_connection_from_one_ip_gets_429()
    {
        await using var factory = new GatewayFactory();
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var inFlight = 0;
        factory.Backends.Respond("live-hub", async (_, _) =>
        {
            Interlocked.Increment(ref inFlight);
            await release.Task;
            return new HttpResponseMessage(HttpStatusCode.OK);
        });
        var client = factory.CreateClient();

        var open = Enumerable.Range(0, 3).Select(_ => client.GetAsync("/hubs/live?id=1", Ct)).ToArray();
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(Ct);
        deadline.CancelAfter(TimeSpan.FromSeconds(10));
        while (Volatile.Read(ref inFlight) < 3)
        {
            await Task.Delay(10, deadline.Token);
        }

        var fourth = await client.GetAsync("/hubs/live?id=1", Ct);
        release.SetResult();
        await Task.WhenAll(open);

        Assert.Equal(HttpStatusCode.TooManyRequests, fourth.StatusCode);
        Assert.All(open, t => Assert.Equal(HttpStatusCode.OK, t.Result.StatusCode));
    }

    [Theory]
    [InlineData("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")]
    [InlineData("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0")]
    public async Task Bot_event_gets_204_without_calling_backend(string userAgent)
    {
        await using var factory = new GatewayFactory();
        using var request = PostEvent();
        request.Headers.TryAddWithoutValidation("User-Agent", userAgent);

        var response = await factory.CreateClient().SendAsync(request, Ct);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(0, factory.Backends.CallsTo("events-api"));
    }

    [Fact]
    public async Task Bot_reading_content_is_proxied()
    {
        await using var factory = new GatewayFactory();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/content/en");
        request.Headers.TryAddWithoutValidation("User-Agent", "Googlebot/2.1");

        var response = await factory.CreateClient().SendAsync(request, Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1, factory.Backends.CallsTo("content-api"));
    }

    [Theory]
    [InlineData("/api/events", 17 * 1024)]
    [InlineData("/api/messages", 5 * 1024)]
    public async Task Too_large_body_gets_413_without_calling_backend(string path, int bytes)
    {
        await using var factory = new GatewayFactory();

        var response = await factory.CreateClient().PostAsync(path, EventBody(bytes), Ct);

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);
        Assert.Equal(0, factory.Backends.CallsTo("events-api"));
    }

    [Theory]
    [InlineData("/api/events", 15 * 1024)]
    [InlineData("/api/messages", 3 * 1024)]
    public async Task Body_within_limit_is_proxied(string path, int bytes)
    {
        await using var factory = new GatewayFactory();

        var response = await factory.CreateClient().PostAsync(path, EventBody(bytes), Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Preflight_from_foreign_origin_has_no_cors_headers()
    {
        await using var factory = new GatewayFactory(new Dictionary<string, string?> { ["Cors:Origins:0"] = SiteOrigin });

        var response = await factory.CreateClient().SendAsync(Preflight("https://evil.example"), Ct);

        Assert.False(response.Headers.Contains("Access-Control-Allow-Origin"));
        Assert.Equal(0, factory.Backends.CallsTo("events-api"));
    }

    [Fact]
    public async Task Preflight_from_site_origin_allows_post_with_traceparent()
    {
        await using var factory = new GatewayFactory(new Dictionary<string, string?> { ["Cors:Origins:0"] = SiteOrigin });

        var response = await factory.CreateClient().SendAsync(Preflight(SiteOrigin), Ct);

        Assert.Equal(SiteOrigin, Assert.Single(response.Headers.GetValues("Access-Control-Allow-Origin")));
        var allowedHeaders = string.Join(",", response.Headers.GetValues("Access-Control-Allow-Headers")).ToLowerInvariant();
        Assert.Contains("traceparent", allowedHeaders);
        Assert.Contains("content-type", allowedHeaders);
        Assert.Equal(0, factory.Backends.CallsTo("events-api"));
    }

    private static HttpRequestMessage Preflight(string origin)
    {
        var request = new HttpRequestMessage(HttpMethod.Options, "/api/events");
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", "content-type,traceparent");
        return request;
    }
}
