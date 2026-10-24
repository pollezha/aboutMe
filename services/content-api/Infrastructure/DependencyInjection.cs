using BuildingBlocks.Persistence;
using ContentApi.Application.Abstractions;
using ContentApi.Infrastructure.Files;
using ContentApi.Infrastructure.Health;
using ContentApi.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace ContentApi.Infrastructure;

public static class DependencyInjection
{
    public static IHostApplicationBuilder AddContentApiInfrastructure(this IHostApplicationBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        // Строка подключения "content" приходит из AppHost; интеграция Aspire добавляет health check БД и OTel
        builder.AddNpgsqlDbContext<ContentDbContext>(
            ContentDbContext.ConnectionName,
            configureDbContextOptions: options => options.UseNpgsql(ContentDbContext.ConfigureNpgsql));
        builder.Services.AddScoped<IContentBundleRepository, ContentBundleRepository>();
        builder.Services.AddScoped<IUnitOfWork, EfUnitOfWork<ContentDbContext>>();

        builder.Services.AddSingleton<IContentSource, JsonContentSource>();

        // Итог сида виден в /health как проверка "content"
        builder.Services.AddSingleton<ContentSeedState>();
        builder.Services.AddSingleton<IContentSeedState>(sp => sp.GetRequiredService<ContentSeedState>());
        builder.Services.AddHealthChecks().AddCheck<ContentSeedHealthCheck>(ContentSeedHealthCheck.Name);

        return builder;
    }
}
