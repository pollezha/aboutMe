using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ContentApi.Data;

/// <summary>Для <c>dotnet ef</c>: модель строится без подключения к БД.</summary>
public sealed class ContentDbContextDesignFactory : IDesignTimeDbContextFactory<ContentDbContext>
{
    public ContentDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<ContentDbContext>()
            .UseNpgsql("Host=localhost;Database=content_design", ContentDbContext.ConfigureNpgsql)
            .Options;
        return new ContentDbContext(options);
    }
}
