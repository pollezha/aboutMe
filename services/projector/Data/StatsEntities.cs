namespace Projector.Data;

/// <summary>Визиты за день в разрезе источника и типа устройства.</summary>
public sealed class DailyVisit
{
    public DateOnly Day { get; set; }
    public required string Source { get; set; }
    public required string Device { get; set; }
    public int Visits { get; set; }
}

/// <summary>Открытия остановок (глав) за день.</summary>
public sealed class StopOpen
{
    public DateOnly Day { get; set; }
    public required string Stop { get; set; }
    public int N { get; set; }
}

/// <summary>Клики по CTA за день в разрезе источника.</summary>
public sealed class CtaClick
{
    public DateOnly Day { get; set; }
    public required string Cta { get; set; }
    public required string Source { get; set; }
    public int N { get; set; }
}

/// <summary>Гистограмма Web Vitals: число замеров метрики в бакете за день (p75 считается по бакетам).</summary>
public sealed class WebVital
{
    public DateOnly Day { get; set; }
    public required string Name { get; set; }
    public int Bucket { get; set; }
    public int N { get; set; }
}

/// <summary>Отметка обработанного события — основа идемпотентности проекции (ADR-0002).</summary>
public sealed class ProcessedEvent
{
    public Guid EventId { get; set; }
    public DateTimeOffset ProcessedAt { get; set; }
}
