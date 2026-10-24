namespace EventsApi.Application.Abstractions;

/// <summary>Salt for <see cref="Domain.Anonymizer"/>: random per UTC day, kept only in memory (design §5.3).</summary>
public interface IDailySalt
{
    /// <summary>Salt of the current UTC day; every caller gets the same value within the day.</summary>
    ReadOnlyMemory<byte> GetCurrent();
}
