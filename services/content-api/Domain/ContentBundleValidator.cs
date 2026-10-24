using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json;
using Contracts.Content;

namespace ContentApi.Domain;

/// <summary>
/// Проверка бандла перед сидом: типизированный снимок версии (<see cref="ContentBundleInfo"/>) и правило AC7 —
/// нет заглушек <c>[ADD]</c> и ссылок <c>href: "#"</c>. Полная JSON Schema проверяется в сборке фронта.
/// </summary>
public static class ContentBundleValidator
{
    public const string AddPlaceholder = "[ADD]";
    private const string ContentVersionFormat = "yyyy-MM-dd'T'HH:mm:ss'Z'";
    private const int DefaultSchemaVersion = 1;

    public static ContentValidationResult Validate(string expectedLang, string sourcePath, byte[] utf8Json)
    {
        ArgumentNullException.ThrowIfNull(utf8Json);

        var errors = new List<string>();
        ContentBundleInfo? parsed;
        try
        {
            using (var document = JsonDocument.Parse(utf8Json))
            {
                FindPlaceholders(document.RootElement, "$", sourcePath, errors);
            }

            parsed = JsonSerializer.Deserialize(utf8Json, ContentJsonContext.Default.ContentBundleInfo);
        }
        catch (JsonException ex)
        {
            return Fail($"{sourcePath}: invalid JSON ({ex.Message})");
        }

        if (parsed is null)
        {
            return Fail($"{sourcePath}: bundle must be a JSON object");
        }

        if (!string.Equals(parsed.Lang, expectedLang, StringComparison.Ordinal))
        {
            errors.Add($"{sourcePath} $.lang: '{parsed.Lang}' does not match file name '{expectedLang}'");
        }

        if (!DateTimeOffset.TryParseExact(parsed.ContentVersion, ContentVersionFormat, CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal, out _))
        {
            errors.Add($"{sourcePath} $.contentVersion: must be UTC time yyyy-MM-ddTHH:mm:ssZ, got '{parsed.ContentVersion}'");
        }

        if (errors.Count > 0)
        {
            return new ContentValidationResult(null, errors);
        }

        var info = new ContentBundleInfo(
            expectedLang,
            parsed.ContentVersion,
            Convert.ToHexStringLower(SHA256.HashData(utf8Json)),
            parsed.SchemaVersion > 0 ? parsed.SchemaVersion : DefaultSchemaVersion);
        return new ContentValidationResult(info, []);
    }

    private static ContentValidationResult Fail(string error) => new(null, [error]);

    private static void FindPlaceholders(JsonElement element, string path, string sourcePath, List<string> errors)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                foreach (var property in element.EnumerateObject())
                {
                    var propertyPath = $"{path}.{property.Name}";
                    if (property.Name == "href" && property.Value.ValueKind == JsonValueKind.String
                        && property.Value.GetString() == "#")
                    {
                        errors.Add($"{sourcePath} {propertyPath}: placeholder link \"#\"");
                        continue;
                    }

                    FindPlaceholders(property.Value, propertyPath, sourcePath, errors);
                }

                break;
            case JsonValueKind.Array:
                var index = 0;
                foreach (var item in element.EnumerateArray())
                {
                    FindPlaceholders(item, $"{path}[{index++}]", sourcePath, errors);
                }

                break;
            case JsonValueKind.String:
                if (element.GetString()!.Contains(AddPlaceholder, StringComparison.Ordinal))
                {
                    errors.Add($"{sourcePath} {path}: contains {AddPlaceholder} placeholder");
                }

                break;
        }
    }
}
