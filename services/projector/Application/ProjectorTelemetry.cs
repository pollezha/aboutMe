using System.Diagnostics;

namespace Projector.Application;

/// <summary>Имена телеметрии projector: источник спанов и метр со счётчиком ядовитых сообщений.</summary>
public static class ProjectorTelemetry
{
    public const string MeterName = "aboutMe.Projector";

    /// <summary>Сообщения, которые не десериализуются в событие; пропускаются, офсет коммитится (DLQ в MVP нет).</summary>
    public const string PoisonCounterName = "events_poison_total";

    /// <summary>Совпадает с <c>IHostEnvironment.ApplicationName</c> — его источник слушает OTel из ServiceDefaults.</summary>
    public static readonly string ActivitySourceName = typeof(ProjectorTelemetry).Assembly.GetName().Name!;

    internal static readonly ActivitySource Source = new(ActivitySourceName);
}
