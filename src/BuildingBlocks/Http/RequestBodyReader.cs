using Microsoft.AspNetCore.Http;

namespace BuildingBlocks.Http;

public enum BodyReadStatus
{
    Ok,
    Empty,
    TooLarge,
}

/// <summary>Outcome of <see cref="RequestBodyReader.ReadAsync"/>; <see cref="Body"/> is non-empty only for <see cref="BodyReadStatus.Ok"/>.</summary>
public readonly record struct BodyReadResult(BodyReadStatus Status, ReadOnlyMemory<byte> Body)
{
    public static BodyReadResult Empty { get; } = new(BodyReadStatus.Empty, ReadOnlyMemory<byte>.Empty);

    public static BodyReadResult TooLarge { get; } = new(BodyReadStatus.TooLarge, ReadOnlyMemory<byte>.Empty);
}

/// <summary>Reads a request body up to a byte limit without throwing on overflow (callers answer 413).</summary>
public static class RequestBodyReader
{
    private const int ChunkSize = 4096;

    public static async Task<BodyReadResult> ReadAsync(HttpRequest request, int maxBytes, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(maxBytes);

        if (request.ContentLength > maxBytes)
        {
            return BodyReadResult.TooLarge;
        }

        using var buffer = new MemoryStream();
        var chunk = new byte[ChunkSize];
        try
        {
            int read;
            while ((read = await request.Body.ReadAsync(chunk, cancellationToken)) > 0)
            {
                if (buffer.Length + read > maxBytes)
                {
                    return BodyReadResult.TooLarge;
                }

                buffer.Write(chunk, 0, read);
            }
        }
        catch (BadHttpRequestException ex) when (ex.StatusCode == StatusCodes.Status413PayloadTooLarge)
        {
            return BodyReadResult.TooLarge;
        }

        return buffer.Length == 0
            ? BodyReadResult.Empty
            : new BodyReadResult(BodyReadStatus.Ok, buffer.ToArray());
    }
}
