using BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace BuildingBlocks.Tests.Persistence;

public sealed class NotesDbContext(DbContextOptions<NotesDbContext> options) : DbContext(options)
{
    public DbSet<Note> Notes => Set<Note>();
}

public sealed class Note
{
    public int Id { get; set; }

    public required string Text { get; set; }
}

[Trait("Category", "Integration")]
public sealed class EfUnitOfWorkTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>, IAsyncLifetime
{
    private readonly string _connectionString = postgres.NewDatabase();

    public async ValueTask InitializeAsync()
    {
        await using var db = CreateContext();
        await db.Database.EnsureCreatedAsync(TestContext.Current.CancellationToken);
    }

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;

    [Fact]
    public async Task Writes_are_invisible_to_others_until_commit_and_visible_after()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var db = CreateContext();
        await using var uow = new EfUnitOfWork<NotesDbContext>(db);

        await uow.BeginAsync(ct);
        db.Notes.Add(new Note { Text = "committed" });
        await db.SaveChangesAsync(ct);

        Assert.Empty(await ReadTextsAsync(ct));

        await uow.CommitAsync(ct);

        Assert.Equal(["committed"], await ReadTextsAsync(ct));
    }

    [Fact]
    public async Task Dispose_without_commit_rolls_back()
    {
        var ct = TestContext.Current.CancellationToken;
        await using (var db = CreateContext())
        {
            await using var uow = new EfUnitOfWork<NotesDbContext>(db);
            await uow.BeginAsync(ct);
            db.Notes.Add(new Note { Text = "lost" });
            await db.SaveChangesAsync(ct);
        }

        Assert.Empty(await ReadTextsAsync(ct));
    }

    [Fact]
    public async Task Every_operation_through_the_same_context_joins_the_transaction()
    {
        var ct = TestContext.Current.CancellationToken;
        await using (var db = CreateContext())
        {
            await using var uow = new EfUnitOfWork<NotesDbContext>(db);
            await uow.BeginAsync(ct);

            // Как два разных репозитория: сырой SQL и change tracker поверх одного DbContext
            await db.Database.ExecuteSqlRawAsync("""INSERT INTO "Notes" ("Text") VALUES ('raw')""", ct);
            db.Notes.Add(new Note { Text = "tracked" });
            await db.SaveChangesAsync(ct);

            Assert.Empty(await ReadTextsAsync(ct));
        }

        Assert.Empty(await ReadTextsAsync(ct));
    }

    [Fact]
    public async Task Second_begin_while_a_transaction_is_open_throws()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var db = CreateContext();
        await using var uow = new EfUnitOfWork<NotesDbContext>(db);
        await uow.BeginAsync(ct);

        await Assert.ThrowsAsync<InvalidOperationException>(() => uow.BeginAsync(ct));
    }

    [Fact]
    public async Task Commit_without_begin_throws()
    {
        await using var db = CreateContext();
        await using var uow = new EfUnitOfWork<NotesDbContext>(db);

        await Assert.ThrowsAsync<InvalidOperationException>(() => uow.CommitAsync(TestContext.Current.CancellationToken));
    }

    private NotesDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<NotesDbContext>().UseNpgsql(_connectionString).Options);

    /// <summary>Чтение отдельным соединением: видно только зафиксированное.</summary>
    private async Task<List<string>> ReadTextsAsync(CancellationToken ct)
    {
        await using var db = CreateContext();
        return await db.Notes.AsNoTracking().OrderBy(n => n.Id).Select(n => n.Text).ToListAsync(ct);
    }
}
