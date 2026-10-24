using System.Security.Cryptography;
using EventsApi.Application.Abstractions;

namespace EventsApi.Infrastructure.Security;

/// <summary>
/// 32 random bytes per UTC day, kept only in this instance's memory: a new day or a restart gives a new salt.
/// Thread-safe; register as a singleton.
/// </summary>
public sealed class InMemoryDailySalt(TimeProvider timeProvider) : IDailySalt
{
    private const int SaltSize = 32;

    private DaySalt? _current;

    public ReadOnlyMemory<byte> GetCurrent()
    {
        var day = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);
        while (true)
        {
            var current = Volatile.Read(ref _current);
            if (current?.Day == day)
            {
                return current.Salt;
            }

            // Первый поток, сменивший сутки, публикует соль; остальные берут уже опубликованную
            var next = new DaySalt(day, RandomNumberGenerator.GetBytes(SaltSize));
            if (Interlocked.CompareExchange(ref _current, next, current) == current)
            {
                return next.Salt;
            }
        }
    }

    private sealed record DaySalt(DateOnly Day, byte[] Salt);
}
