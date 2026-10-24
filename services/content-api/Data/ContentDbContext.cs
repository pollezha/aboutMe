using Microsoft.EntityFrameworkCore;
using Npgsql.EntityFrameworkCore.PostgreSQL.Infrastructure;

namespace ContentApi.Data;

/// <summary>Бандлы контента в схеме <c>content</c> (docs/design/architecture.md §5.7, §5.8).</summary>
public sealed class ContentDbContext(DbContextOptions<ContentDbContext> options) : DbContext(options)
{
    public const string Schema = "content";
    public const string ConnectionName = "content";

    public DbSet<ContentBundle> Bundles => Set<ContentBundle>();

    /// <summary>
    /// История миграций живёт в той же схеме — роль <c>content_rw</c> не трогает <c>public</c>.
    /// </summary>
    public static void ConfigureNpgsql(NpgsqlDbContextOptionsBuilder npgsql) =>
        npgsql.MigrationsHistoryTable("__ef_migrations_history", Schema);

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);

        modelBuilder.Entity<ContentBundle>(e =>
        {
            e.ToTable("bundles");
            e.HasKey(x => x.Lang).HasName("pk_bundles");
            e.Property(x => x.Lang).HasColumnName("lang").HasColumnType("text");
            e.Property(x => x.ContentVersion).HasColumnName("content_version").HasColumnType("text");
            e.Property(x => x.VersionHash).HasColumnName("version_hash").HasColumnType("text");
            e.Property(x => x.Json).HasColumnName("json").HasColumnType("jsonb");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasColumnType("timestamptz")
                .HasDefaultValueSql("now()");
        });
    }
}
