using Contracts.Content;

namespace ContentApi.Domain;

/// <summary>Результат проверки файла бандла: снимок версии либо список ошибок «файл $.путь: причина».</summary>
public sealed record ContentValidationResult(ContentBundleInfo? Info, IReadOnlyList<string> Errors)
{
    public bool IsValid => Errors.Count == 0;
}
