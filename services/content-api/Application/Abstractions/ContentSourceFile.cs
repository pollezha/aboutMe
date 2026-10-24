namespace ContentApi.Application.Abstractions;

/// <summary>Файл бандла: путь для сообщений об ошибках и байты (<c>null</c> — файла нет).</summary>
public sealed record ContentSourceFile(string SourcePath, byte[]? Utf8Json);
