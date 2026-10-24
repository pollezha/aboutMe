using EventsApi.Application.Abstractions;

namespace EventsApi.Tests.Application;

public sealed class FixedDailySalt : IDailySalt
{
    private readonly byte[] _salt = [.. Enumerable.Range(1, 32).Select(i => (byte)i)];

    public ReadOnlyMemory<byte> GetCurrent() => _salt;
}
