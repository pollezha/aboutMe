namespace Gateway.Edge.Options;

internal sealed class BotsOptions
{
    public const string SectionName = "Bots";

    // Подстроки User-Agent (без учёта регистра)
    public List<string> UserAgents { get; init; } = [];
}
