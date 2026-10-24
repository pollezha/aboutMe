using Contracts.Events;
using Contracts.Live;
using LiveHub.Application.Abstractions;
using LiveHub.Domain;

namespace LiveHub.Infrastructure.InMemory;

// Состояние в памяти процесса (БД у live-hub нет): после рестарта его восстанавливает перемотка журнала на
// начало суток. Lock сериализует консьюмер, рассылку и подключения к хабу.
public sealed class InMemoryLiveStateRepository(TimeProvider time) : ILiveStateRepository
{
    private readonly Lock _lock = new();
    private readonly LiveState _state = new(time);

    public bool Apply(SiteEvent siteEvent)
    {
        lock (_lock)
        {
            return _state.Apply(siteEvent);
        }
    }

    public LiveSnapshot GetSnapshot()
    {
        lock (_lock)
        {
            return _state.Snapshot();
        }
    }
}
