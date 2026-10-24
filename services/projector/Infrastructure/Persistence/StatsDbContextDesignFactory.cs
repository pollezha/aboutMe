using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Projector.Infrastructure.Persistence;

/// <summary>
/// Для <c>dotnet ef</c>: модель строится без подключения к БД (строка подключения не используется при
/// <c>migrations add/list --no-connect</c>).
/// </summary>
public sealed class StatsDbContextDesignFactory : IDesignTimeDbContextFactory<StatsDbContext>
{
    public StatsDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<StatsDbContext>()
            .UseNpgsql("Host=localhost;Database=stats_design", StatsDbContext.ConfigureNpgsql)
            .Options;
        return new StatsDbContext(options);
    }
}
