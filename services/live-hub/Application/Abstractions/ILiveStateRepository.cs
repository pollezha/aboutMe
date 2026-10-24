using Contracts.Events;
using Contracts.Live;

namespace LiveHub.Application.Abstractions;

/// <summary>
/// Живые счётчики за текущие UTC-сутки (<see cref="Domain.LiveState"/>). Реализация потокобезопасна:
/// консьюмер пишет, хаб и рассылка читают одновременно.
/// </summary>
public interface ILiveStateRepository
{
    /// <summary>Учитывает событие; повтор <c>eventId</c> за сутки не считается.</summary>
    /// <returns><c>true</c> — снапшот изменился (новое событие сегодня или новая онлайн-сессия).</returns>
    bool Apply(SiteEvent siteEvent);

    /// <summary>Копия счётчиков на текущий момент (онлайн без сессий, выпавших из окна).</summary>
    LiveSnapshot GetSnapshot();
}
