namespace ContentApi.Domain;

/// <summary>Бандл контента одного языка (строка <c>content.bundles</c>).</summary>
public sealed class ContentBundle
{
    /// <summary>Языки, которые отдаёт API и которые сидятся из <c>content/{lang}.json</c>.</summary>
    public static readonly IReadOnlyList<string> SupportedLangs = ["en", "ru"];

    public required string Lang { get; set; }
    public required string ContentVersion { get; set; }

    /// <summary>SHA-256 байтов файла в hex; он же ETag.</summary>
    public required string VersionHash { get; set; }

    /// <summary>Весь бандл как JSON-текст (колонка <c>jsonb</c>).</summary>
    public required string Json { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public static bool IsSupported(string lang) => SupportedLangs.Contains(lang, StringComparer.Ordinal);
}
