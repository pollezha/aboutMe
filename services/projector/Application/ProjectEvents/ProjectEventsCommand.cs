using System.Diagnostics;
using Contracts.Events;

namespace Projector.Application.ProjectEvents;

/// <summary>Батч событий из журнала и ссылки на спаны <c>process</c> его сообщений.</summary>
public sealed record ProjectEventsCommand(IReadOnlyList<SiteEvent> Events, IReadOnlyList<ActivityLink> Links);
