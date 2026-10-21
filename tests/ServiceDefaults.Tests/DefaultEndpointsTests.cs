using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
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

    // /alive не должен падать из-за зависимостей: иначе оркестратор перезапустит здоровый процесс при сбое БД.
    [Fact]
    public async Task Alive_ignores_unhealthy_dependency_checks_while_health_reports_them()
    {
        await using var app = await StartAppAsync(
            "Production",
            mapDefaultEndpoints: true,
            configureHealthChecks: checks => checks.AddCheck("dep", () => HealthCheckResult.Unhealthy()));
        var client = app.GetTestClient();

        var alive = await client.GetAsync("/alive", TestContext.Current.CancellationToken);
        var health = await client.GetAsync("/health", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, alive.StatusCode);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, health.StatusCode);
    }

    private static async Task<WebApplication> StartAppAsync(
        string environment,
        bool mapDefaultEndpoints,
        Action<IHealthChecksBuilder>? configureHealthChecks = null)
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = environment });
        builder.WebHost.UseTestServer();
        builder.AddServiceDefaults();
        configureHealthChecks?.Invoke(builder.Services.AddHealthChecks());

        var app = builder.Build();
        if (mapDefaultEndpoints)
        {
            app.MapDefaultEndpoints();
        }

        await app.StartAsync(TestContext.Current.CancellationToken);
        return app;
    }
}
