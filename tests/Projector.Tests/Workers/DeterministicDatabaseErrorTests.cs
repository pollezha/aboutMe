using Microsoft.EntityFrameworkCore;
using Npgsql;
using Projector.Workers;
using Xunit;

namespace Projector.Tests.Workers;

public sealed class DeterministicDatabaseErrorTests
{
    [Theory]
    [InlineData("22021")] // NUL в text
    [InlineData("22001")] // строка длиннее столбца
    [InlineData("23502")] // NOT NULL
    [InlineData("23505")] // unique
    public void Data_and_integrity_errors_are_poison(string sqlState)
    {
        Assert.True(ProjectorWorker.IsDeterministicDatabaseError(Postgres(sqlState)));
        Assert.True(ProjectorWorker.IsDeterministicDatabaseError(new DbUpdateException("wrapped", Postgres(sqlState))));
    }

    [Theory]
    [InlineData("08006")] // соединение
    [InlineData("40001")] // serialization failure
    [InlineData("40P01")] // deadlock
    [InlineData("53300")] // too many connections
    [InlineData("57P01")] // admin shutdown
    [InlineData("42P01")] // нет таблицы: миграция ещё не применена
    public void Transient_errors_are_retried(string sqlState) =>
        Assert.False(ProjectorWorker.IsDeterministicDatabaseError(Postgres(sqlState)));

    [Fact]
    public void Non_database_errors_are_retried()
    {
        Assert.False(ProjectorWorker.IsDeterministicDatabaseError(new TimeoutException()));
        Assert.False(ProjectorWorker.IsDeterministicDatabaseError(new NpgsqlException("connection refused")));
    }

    private static PostgresException Postgres(string sqlState) => new("error", "ERROR", "ERROR", sqlState);
}
