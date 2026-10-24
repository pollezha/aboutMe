namespace Gateway.Edge.Options;

internal sealed class CorsOptions
{
    public const string SectionName = "Cors";

    // Домены сайта, которым разрешено звать API
    public List<string> Origins { get; init; } = [];
}
