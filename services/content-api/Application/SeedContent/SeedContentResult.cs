namespace ContentApi.Application.SeedContent;

/// <summary>Исход <see cref="SeedContentHandler"/>.</summary>
public abstract record SeedContentResult
{
    private SeedContentResult()
    {
    }

    /// <summary>Все бандлы валидны и сохранены; <see cref="SeededBundle.Changed"/> — строка переписана.</summary>
    public sealed record Seeded(IReadOnlyList<SeededBundle> Bundles) : SeedContentResult;

    /// <summary>Хотя бы один бандл отсутствует или невалиден; в хранилище ничего не записано.</summary>
    /// <param name="Errors">«файл $.путь: причина».</param>
    public sealed record Failed(IReadOnlyList<string> Errors) : SeedContentResult;
}
