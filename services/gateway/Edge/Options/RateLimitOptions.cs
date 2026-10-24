namespace Gateway.Edge.Options;

// Лимиты по IP посетителя (design §5.2)
internal sealed class RateLimitOptions
{
    public const string SectionName = "RateLimits";

    public FixedWindowLimit Events { get; init; } = new();

    public FixedWindowLimit Messages { get; init; } = new();

    public ConcurrencyLimit Hubs { get; init; } = new();
}

internal sealed class FixedWindowLimit
{
    public int PermitLimit { get; init; }

    public TimeSpan Window { get; init; }
}

internal sealed class ConcurrencyLimit
{
    public int PermitLimit { get; init; }
}
