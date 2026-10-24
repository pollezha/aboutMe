namespace Projector.Projection;

/// <summary>Приращение одной строки агрегата в схеме <c>stats</c>: измерения — ключ строки, <see cref="N"/> — прибавка.</summary>
public abstract record StatsDelta(int N);

public sealed record DailyVisitDelta(DateOnly Day, string Source, string Device, int N) : StatsDelta(N);

public sealed record StopOpenDelta(DateOnly Day, string Stop, int N) : StatsDelta(N);

public sealed record CtaClickDelta(DateOnly Day, string Cta, string Source, int N) : StatsDelta(N);

public sealed record WebVitalDelta(DateOnly Day, string Name, int Bucket, int N) : StatsDelta(N);
