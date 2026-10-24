namespace Gateway.Edge.Options;

internal sealed class HealthOptions
{
    public const string SectionName = "Health";

    // Хосты внутренней сети, с которых доступен сводный /health (без порта)
    public List<string> AllowedHosts { get; init; } = [];

    public TimeSpan Timeout { get; init; } = TimeSpan.FromSeconds(2);

    public TimeSpan CacheDuration { get; init; } = TimeSpan.FromSeconds(5);

    // Имя сервиса → URI его /health (имя хоста разрешает service discovery)
    public Dictionary<string, Uri> Backends { get; init; } = [];
}
