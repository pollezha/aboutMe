using Microsoft.Extensions.Logging.Abstractions;
using Projector.Infrastructure.Persistence;
using Xunit;

namespace Projector.Tests;

public sealed class StatsMigrationsTests
{
    [Fact]
    public async Task Apply_returns_nonzero_when_database_is_unreachable()
    {
        await using var services = PostgresFixture.CreateServices("Host=127.0.0.1;Port=1;Database=stats;Timeout=2");

        var exitCode = await StatsMigrations.ApplyAsync(services, NullLogger.Instance, TestContext.Current.CancellationToken);

        Assert.NotEqual(0, exitCode);
    }
}
