using ContentApi.Domain;

namespace ContentApi.Application.Abstractions;

/// <summary>Бандлы контента по языкам (таблица <c>content.bundles</c>).</summary>
public interface IContentBundleRepository
{
    /// <returns>Бандл языка или <c>null</c>, если он ещё не засеян.</returns>
    Task<ContentBundle?> GetByLangAsync(string lang, CancellationToken cancellationToken);

    /// <summary>
    /// Вставляет или переписывает бандл языка; строка с тем же <see cref="ContentBundle.VersionHash"/> не
    /// переписывается (атомарно, без гонки между экземплярами). <see cref="ContentBundle.UpdatedAt"/> ставит хранилище.
    /// </summary>
    Task UpsertAsync(ContentBundle bundle, CancellationToken cancellationToken);
}
