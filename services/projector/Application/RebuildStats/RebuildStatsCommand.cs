namespace Projector.Application.RebuildStats;

/// <summary>Пересчёт агрегатов из журнала для consumer group projector.</summary>
public sealed record RebuildStatsCommand(string ConsumerGroup);
