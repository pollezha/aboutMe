using System.Net;
using Aspire.Hosting.Testing;
using Xunit;

namespace AppHost.Tests;

// Интеграционный: поднимает AppHost целиком, как `dotnet run --project src/AppHost` (AC13)
public sealed class AppHostTests
{
    private static readonly TimeSpan StartupTimeout = TimeSpan.FromSeconds(60);

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Gateway_starts_healthy_and_serves_health()
    {
        var ct = TestContext.Current.CancellationToken;
        var appHost = await DistributedApplicationTestingBuilder.CreateAsync<Projects.AppHost>(ct);

        await using var app = await appHost.BuildAsync(ct).WaitAsync(StartupTimeout, ct);
        await app.StartAsync(ct).WaitAsync(StartupTimeout, ct);
        await app.ResourceNotifications.WaitForResourceHealthyAsync("gateway", ct).WaitAsync(StartupTimeout, ct);

        using var client = app.CreateHttpClient("gateway");
        using var response = await client.GetAsync("/health", ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
