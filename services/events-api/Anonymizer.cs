using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;

namespace EventsApi;

/// <summary>
/// Replaces the browser session id with <c>base64url(HMAC-SHA256(sessionId, dailySalt))</c> (design §5.3).
/// The salt is 32 random bytes per UTC day, kept only in memory: a new day or a restart makes hashes unlinkable.
/// Thread-safe; register as a singleton.
/// </summary>
public sealed class Anonymizer(TimeProvider timeProvider)
{
    private const int SaltSize = 32;

    private DailySalt? _current;

    public string Hash(string sessionId)
    {
        ArgumentNullException.ThrowIfNull(sessionId);

        var salt = SaltFor(DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime));
        var mac = HMACSHA256.HashData(salt, Encoding.UTF8.GetBytes(sessionId));
        return Base64Url.EncodeToString(mac);
    }

    private byte[] SaltFor(DateOnly day)
    {
        while (true)
        {
            var current = Volatile.Read(ref _current);
            if (current?.Day == day)
            {
                return current.Salt;
            }

            // Первый поток, сменивший сутки, публикует соль; остальные берут уже опубликованную
            var next = new DailySalt(day, RandomNumberGenerator.GetBytes(SaltSize));
            if (Interlocked.CompareExchange(ref _current, next, current) == current)
            {
                return next.Salt;
            }
        }
    }

    private sealed record DailySalt(DateOnly Day, byte[] Salt);
}
