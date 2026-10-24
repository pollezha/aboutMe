namespace ContentApi.Data;

/// <summary>Бандл контента одного языка (строка <c>content.bundles</c>).</summary>
public sealed class ContentBundle
{
    public required string Lang { get; set; }
    public required string ContentVersion { get; set; }
    public required string VersionHash { get; set; }

    /// <summary>Весь бандл как JSON-текст (колонка <c>jsonb</c>).</summary>
    public required string Json { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
