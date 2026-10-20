using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Hosting;
using Xunit;

namespace ServiceDefaults.Tests;

public sealed class DefaultEndpointsTests
{
    // В проде /health нужен smoke-тесту CD, /alive — blackbox-проверкам и uptime-пингу.
    [Theory]
    [InlineData("Development", "/health")]
    [InlineData("Development", "/alive")]
    [InlineData("Production", "/health")]
    [InlineData("Production", "/alive")]
    public async Task Default_endpoints_return_200_in_every_environment(string environment, string path)
    {
        await using var app = await StartAppAsync(environment, mapDefaultEndpoints: true);

        var response = await app.GetTestClient().GetAsync(path, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Theory]
    [InlineData("/health")]
    [InlineData("/alive")]
    public async Task Endpoints_are_absent_without_MapDefaultEndpoints(string path)
    {
        await using var app = await StartAppAsync("Production", mapDefaultEndpoints: false);

        var response = await app.GetTestClient().GetAsync(path, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private static async Task<WebApplication> StartAppAsync(string environment, bool mapDefaultEndpoints)
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = environment });
        builder.WebHost.UseTestServer();
        builder.AddServiceDefaults();

        var app = builder.Build();
        if (mapDefaultEndpoints)
        {
            app.MapDefaultEndpoints();
        }

        await app.StartAsync(TestContext.Current.CancellationToken);
        return app;
    }
}
