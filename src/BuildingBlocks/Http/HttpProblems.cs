using System.Globalization;
using Microsoft.AspNetCore.Http;

namespace BuildingBlocks.Http;

/// <summary>
/// <c>application/problem+json</c> responses (RFC 9457) shared by services. Only fixed titles and limits go into
/// the body — never exception details.
/// </summary>
public static class HttpProblems
{
    public static IResult Validation(IDictionary<string, string[]> errors) => Results.ValidationProblem(errors);

    public static IResult BadRequest(string title) =>
        Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: title);

    public static IResult NotFound(string title, string? detail = null) =>
        Results.Problem(statusCode: StatusCodes.Status404NotFound, title: title, detail: detail);

    public static IResult PayloadTooLarge(int maxBytes) =>
        Results.Problem(
            statusCode: StatusCodes.Status413PayloadTooLarge,
            title: "Request body too large",
            detail: string.Create(CultureInfo.InvariantCulture, $"The body must be at most {maxBytes} bytes."));

    /// <summary>429 with <c>Retry-After</c> in whole seconds, rounded up (at least 1).</summary>
    public static IResult TooManyRequests(TimeSpan retryAfter)
    {
        var seconds = Math.Max(1, (long)Math.Ceiling(retryAfter.TotalSeconds));
        return new WithRetryAfter(
            Results.Problem(statusCode: StatusCodes.Status429TooManyRequests, title: "Too many requests"),
            seconds);
    }

    public static IResult ServiceUnavailable(string title) =>
        Results.Problem(statusCode: StatusCodes.Status503ServiceUnavailable, title: title);

    private sealed class WithRetryAfter(IResult inner, long seconds) : IResult
    {
        public Task ExecuteAsync(HttpContext httpContext)
        {
            ArgumentNullException.ThrowIfNull(httpContext);
            httpContext.Response.Headers.RetryAfter = seconds.ToString(CultureInfo.InvariantCulture);
            return inner.ExecuteAsync(httpContext);
        }
    }
}
