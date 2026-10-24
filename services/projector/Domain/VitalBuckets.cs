using Contracts.Events;

namespace Projector.Domain;

/// <summary>
/// Границы бакетов гистограммы Web Vitals (<c>stats.web_vitals.bucket</c>); p75 считается по ним.
/// Бакет — индекс первой верхней границы, которая не меньше значения (граница включительно, как <c>le</c> в Prometheus).
/// Менять границы можно только с пересчётом (<c>rebuild</c>): старые строки хранят индексы старых границ.
/// </summary>
public static class VitalBuckets
{
    // LCP, FCP, TTFB — миллисекунды
    private static readonly double[] TimingMs = [500, 1000, 1500, 2000, 2500, 3000, 4000, 6000, double.PositiveInfinity];

    private static readonly double[] InpMs = [100, 200, 300, 500, 1000, double.PositiveInfinity];

    // CLS — безразмерный
    private static readonly double[] Cls = [0.05, 0.1, 0.15, 0.25, 0.5, double.PositiveInfinity];

    /// <returns>Индекс бакета или null для неизвестной метрики.</returns>
    public static int? Bucket(string name, double value)
    {
        var bounds = BoundsFor(name);
        return bounds is null ? null : Array.FindIndex(bounds, bound => value <= bound);
    }

    private static double[]? BoundsFor(string name) => name switch
    {
        WebVitalNames.Lcp or WebVitalNames.Fcp or WebVitalNames.Ttfb => TimingMs,
        WebVitalNames.Inp => InpMs,
        WebVitalNames.Cls => Cls,
        _ => null,
    };
}
