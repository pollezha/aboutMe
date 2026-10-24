using EventsApi.Domain;
using EventsApi.Infrastructure.Security;
using Xunit;

namespace EventsApi.Tests;

/// <summary><see cref="Anonymizer"/> with the production <see cref="InMemoryDailySalt"/>.</summary>
public sealed class AnonymizerTests
{
    private static readonly DateTimeOffset Day1 = new(2026, 10, 20, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Hash_is_stable_within_one_utc_day()
    {
        var midnight = new DateTimeOffset(2026, 10, 20, 0, 0, 0, TimeSpan.Zero);
        var clock = new ManualTimeProvider(midnight.AddMinutes(1));
        var salt = new InMemoryDailySalt(clock);

        var morning = Hash(salt, "session-1");
        clock.UtcNow = midnight.AddDays(1).AddTicks(-1);
        var evening = Hash(salt, "session-1");

        Assert.Equal(morning, evening);
    }

    [Fact]
    public void Same_session_on_different_utc_days_gets_different_hashes()
    {
        var clock = new ManualTimeProvider(Day1);
        var salt = new InMemoryDailySalt(clock);

        var first = Hash(salt, "session-1");
        clock.UtcNow = Day1.AddDays(1);
        var second = Hash(salt, "session-1");

        Assert.NotEqual(first, second);
    }

    [Fact]
    public void Different_sessions_get_different_hashes()
    {
        var salt = new InMemoryDailySalt(new ManualTimeProvider(Day1));

        Assert.NotEqual(Hash(salt, "session-1"), Hash(salt, "session-2"));
    }

    [Fact]
    public void Hash_is_base64url_of_hmac_sha256_and_does_not_contain_the_session_id()
    {
        var salt = new InMemoryDailySalt(new ManualTimeProvider(Day1));

        var hash = Hash(salt, "session-1");

        // 32 байта HMAC-SHA256 → 43 символа base64url без паддинга
        Assert.Equal(43, hash.Length);
        Assert.Matches("^[A-Za-z0-9_-]+$", hash);
        Assert.DoesNotContain("session-1", hash, StringComparison.Ordinal);
    }

    [Fact]
    public void Salt_is_random_per_instance_so_restart_changes_hashes()
    {
        var clock = new ManualTimeProvider(Day1);

        Assert.NotEqual(Hash(new InMemoryDailySalt(clock), "session-1"), Hash(new InMemoryDailySalt(clock), "session-1"));
    }

    [Fact]
    public async Task Concurrent_calls_on_the_same_day_agree_on_one_salt()
    {
        var salt = new InMemoryDailySalt(new ManualTimeProvider(Day1));

        var hashes = await Task.WhenAll(Enumerable.Range(0, 64).Select(_ => Task.Run(() => Hash(salt, "session-1"))));

        Assert.Single(hashes.Distinct(StringComparer.Ordinal));
    }

    private static string Hash(InMemoryDailySalt salt, string sessionId) => Anonymizer.Hash(sessionId, salt.GetCurrent().Span);
}
