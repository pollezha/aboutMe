namespace ContentApi.Application.GetContent;

/// <param name="Lang">Язык из маршрута, сравнивается с учётом регистра.</param>
/// <param name="IfNoneMatch">Теги из <c>If-None-Match</c> как в заголовке: <c>"hash"</c>, <c>W/"hash"</c> или <c>*</c>.</param>
public sealed record GetContentQuery(string Lang, IReadOnlyList<string> IfNoneMatch);
