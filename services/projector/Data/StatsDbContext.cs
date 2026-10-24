using Microsoft.EntityFrameworkCore;
using Npgsql.EntityFrameworkCore.PostgreSQL.Infrastructure;

namespace Projector.Data;

/// <summary>Агрегаты статистики в схеме <c>stats</c> (docs/design/architecture.md §5.5, §5.8).</summary>
public sealed class StatsDbContext(DbContextOptions<StatsDbContext> options) : DbContext(options)
{
    public const string Schema = "stats";
    public const string ConnectionName = "stats";

    public DbSet<DailyVisit> DailyVisits => Set<DailyVisit>();
    public DbSet<StopOpen> StopOpens => Set<StopOpen>();
    public DbSet<CtaClick> CtaClicks => Set<CtaClick>();
    public DbSet<WebVital> WebVitals => Set<WebVital>();
    public DbSet<ProcessedEvent> ProcessedEvents => Set<ProcessedEvent>();

    /// <summary>
    /// Общие настройки провайдера: история миграций живёт в той же схеме — роль <c>stats_rw</c> не трогает <c>public</c>.
    /// </summary>
    public static void ConfigureNpgsql(NpgsqlDbContextOptionsBuilder npgsql) =>
        npgsql.MigrationsHistoryTable("__ef_migrations_history", Schema);

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);

        modelBuilder.Entity<DailyVisit>(e =>
        {
            e.ToTable("daily_visits");
            e.HasKey(x => new { x.Day, x.Source, x.Device }).HasName("pk_daily_visits");
            e.Property(x => x.Day).HasColumnName("day").HasColumnType("date");
            e.Property(x => x.Source).HasColumnName("source").HasColumnType("text");
            e.Property(x => x.Device).HasColumnName("device").HasColumnType("text");
            e.Property(x => x.Visits).HasColumnName("visits");
        });

        modelBuilder.Entity<StopOpen>(e =>
        {
            e.ToTable("stop_opens");
            e.HasKey(x => new { x.Day, x.Stop }).HasName("pk_stop_opens");
            e.Property(x => x.Day).HasColumnName("day").HasColumnType("date");
            e.Property(x => x.Stop).HasColumnName("stop").HasColumnType("text");
            e.Property(x => x.N).HasColumnName("n");
        });

        modelBuilder.Entity<CtaClick>(e =>
        {
            e.ToTable("cta_clicks");
            e.HasKey(x => new { x.Day, x.Cta, x.Source }).HasName("pk_cta_clicks");
            e.Property(x => x.Day).HasColumnName("day").HasColumnType("date");
            e.Property(x => x.Cta).HasColumnName("cta").HasColumnType("text");
            e.Property(x => x.Source).HasColumnName("source").HasColumnType("text");
            e.Property(x => x.N).HasColumnName("n");
        });

        modelBuilder.Entity<WebVital>(e =>
        {
            e.ToTable("web_vitals");
            e.HasKey(x => new { x.Day, x.Name, x.Bucket }).HasName("pk_web_vitals");
            e.Property(x => x.Day).HasColumnName("day").HasColumnType("date");
            e.Property(x => x.Name).HasColumnName("name").HasColumnType("text");
            e.Property(x => x.Bucket).HasColumnName("bucket");
            e.Property(x => x.N).HasColumnName("n");
        });

        modelBuilder.Entity<ProcessedEvent>(e =>
        {
            e.ToTable("processed_events");
            e.HasKey(x => x.EventId).HasName("pk_processed_events");
            e.Property(x => x.EventId).HasColumnName("event_id").ValueGeneratedNever();
            e.Property(x => x.ProcessedAt).HasColumnName("processed_at").HasColumnType("timestamptz")
                .HasDefaultValueSql("now()");
            // Очистка отметок старше 30 дней (§5.5) идёт по этому индексу
            e.HasIndex(x => x.ProcessedAt).HasDatabaseName("ix_processed_events_processed_at");
        });
    }
}
