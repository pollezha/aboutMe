namespace ContentApi.Application.SeedContent;

/// <param name="Langs">Языки, бандлы которых обязаны быть в источнике.</param>
public sealed record SeedContentCommand(IReadOnlyList<string> Langs);
