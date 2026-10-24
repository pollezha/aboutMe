namespace ContentApi.Application.Abstractions;

/// <summary>Исходные файлы бандлов (<c>content/{lang}.json</c>).</summary>
public interface IContentSource
{
    /// <summary>
    /// Читает бандл языка. Отсутствующий файл — <see cref="ContentSourceFile.Utf8Json"/> = <c>null</c>;
    /// недоступный источник целиком — исключение.
    /// </summary>
    Task<ContentSourceFile> ReadAsync(string lang, CancellationToken cancellationToken);
}
