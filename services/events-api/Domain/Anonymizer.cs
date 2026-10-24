using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;

namespace EventsApi.Domain;

/// <summary>
/// Replaces the browser session id with <c>base64url(HMAC-SHA256(sessionId, salt))</c> (design §5.3).
/// With a daily salt kept only in memory, a new day or a restart makes hashes unlinkable.
/// </summary>
public static class Anonymizer
{
    public static string Hash(string sessionId, ReadOnlySpan<byte> salt)
    {
        ArgumentNullException.ThrowIfNull(sessionId);

        var mac = HMACSHA256.HashData(salt, Encoding.UTF8.GetBytes(sessionId));
        return Base64Url.EncodeToString(mac);
    }
}
