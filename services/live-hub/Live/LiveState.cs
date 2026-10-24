using System.Text.Json;
using Contracts.Events;
using Contracts.Live;

namespace LiveHub.Live;

// Живые счётчики в памяти (design §5.6). Онлайн — уникальные sessionHash с активностью за последние 5 мин;
// «сегодня» — по receivedAt в текущих UTC-сутках, сброс при смене суток. Повторная доставка (и перечитывание
// журнала при рестарте/ребалансе) не удваивает счётчики: eventId за сутки запоминается.
public sealed class LiveState(TimeProvider time)
{
    public static readonly TimeSpan OnlineWindow = TimeSpan.FromMinutes(5);

    private readonly Lock _lock = new();
    private readonly Dictionary<string, DateTimeOffset> _lastSeen = new(StringComparer.Ordinal);
    private readonly HashSet<Guid> _seenToday = [];
    private readonly Dictionary<string, int> _byType = new(StringComparer.Ordinal);
    private readonly Dictionary<string, int> _byStop = new(StringComparer.Ordinal);
    private readonly Dictionary<string, int> _byCta = new(StringComparer.Ordinal);
    private DateOnly _day;
    private int _eventsToday;

    // true — снапшот изменился (новое событие сегодня или новая онлайн-сессия)
    public bool Apply(SiteEvent siteEvent)
    {
        ArgumentNullException.ThrowIfNull(siteEvent);

        lock (_lock)
        {
            var now = time.GetUtcNow();
            RollDay(now);

            var changed = Touch(siteEvent.SessionHash, siteEvent.ReceivedAt, now);

            if (DateOnly.FromDateTime(siteEvent.ReceivedAt.UtcDateTime) != _day || !_seenToday.Add(siteEvent.EventId))
            {
                return changed;
            }

            _eventsToday++;
            Increment(_byType, siteEvent.Type);
            switch (siteEvent.Type)
            {
                case EventTypes.StopOpened:
                    Increment(_byStop, PayloadString(siteEvent.Payload, "stop"));
                    break;
                case EventTypes.CtaClick:
                    Increment(_byCta, PayloadString(siteEvent.Payload, "cta"));
                    break;
            }

            return true;
        }
    }

    public LiveSnapshot Snapshot()
    {
        lock (_lock)
        {
            var now = time.GetUtcNow();
            RollDay(now);
            PruneOffline(now);

            return new LiveSnapshot(
                _lastSeen.Count,
                _eventsToday,
                new Dictionary<string, int>(_byType, StringComparer.Ordinal),
                new Dictionary<string, int>(_byStop, StringComparer.Ordinal),
                new Dictionary<string, int>(_byCta, StringComparer.Ordinal),
                now);
        }
    }

    // true — сессия стала онлайн (до этого её в окне не было)
    private bool Touch(string sessionHash, DateTimeOffset seenAt, DateTimeOffset now)
    {
        if (seenAt <= now - OnlineWindow)
        {
            return false;
        }

        if (_lastSeen.TryGetValue(sessionHash, out var previous) && previous > now - OnlineWindow)
        {
            _lastSeen[sessionHash] = previous > seenAt ? previous : seenAt;
            return false;
        }

        _lastSeen[sessionHash] = seenAt;
        return true;
    }

    private void PruneOffline(DateTimeOffset now)
    {
        var threshold = now - OnlineWindow;
        foreach (var (session, seenAt) in _lastSeen)
        {
            if (seenAt <= threshold)
            {
                _lastSeen.Remove(session);
            }
        }
    }

    private void RollDay(DateTimeOffset now)
    {
        var today = DateOnly.FromDateTime(now.UtcDateTime);
        if (today == _day)
        {
            return;
        }

        _day = today;
        _eventsToday = 0;
        _seenToday.Clear();
        _byType.Clear();
        _byStop.Clear();
        _byCta.Clear();
    }

    private static void Increment(Dictionary<string, int> counters, string? key)
    {
        if (string.IsNullOrEmpty(key))
        {
            return;
        }

        counters[key] = counters.GetValueOrDefault(key) + 1;
    }

    private static string? PayloadString(JsonElement payload, string property) =>
        payload.ValueKind == JsonValueKind.Object
        && payload.TryGetProperty(property, out var value)
        && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;
}
