namespace Gateway.Edge.Options;

internal sealed class ForwardedHeadersOptions
{
    public const string SectionName = "ForwardedHeaders";

    // Адреса доверенного прокси (контейнер Caddy); пустой список — не доверять никому
    public List<string> KnownProxies { get; init; } = [];
}
