using Contracts.Events;

namespace LiveHub.Application.ApplyLiveEvent;

/// <summary>Событие из журнала <c>site.events.v1</c>, уже прошедшее десериализацию.</summary>
public sealed record ApplyLiveEventCommand(SiteEvent Event);
