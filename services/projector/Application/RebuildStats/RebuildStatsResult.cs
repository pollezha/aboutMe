namespace Projector.Application.RebuildStats;

public enum RebuildStatsResult
{
    /// <summary>Офсеты сброшены на начало, агрегаты очищены.</summary>
    Done,

    /// <summary>Projector ещё работает (у группы есть участники): ничего не тронуто.</summary>
    GroupActive,
}
