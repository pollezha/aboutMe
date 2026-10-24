using System.Text.Json;
using BuildingBlocks.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BuildingBlocks.Tests.Http;

public sealed class HttpProblemsTests
{
    private const string ProblemJson = "application/problem+json";

    private static async Task<(HttpResponse Response, JsonElement Body)> ExecuteAsync(IResult result)
    {
        var context = new DefaultHttpContext
        {
            RequestServices = new ServiceCollection().AddLogging().BuildServiceProvider(),
        };
        var body = new MemoryStream();
        context.Response.Body = body;

        await result.ExecuteAsync(context);

        body.Position = 0;
        using var document = await JsonDocument.ParseAsync(body, cancellationToken: TestContext.Current.CancellationToken);
        return (context.Response, document.RootElement.Clone());
    }

    [Fact]
    public async Task Validation_problem_is_400_with_errors_by_field()
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal) { ["text"] = ["Required."] };

        var (response, body) = await ExecuteAsync(HttpProblems.Validation(errors));

        Assert.Equal(StatusCodes.Status400BadRequest, response.StatusCode);
        Assert.StartsWith(ProblemJson, response.ContentType, StringComparison.Ordinal);
        Assert.Equal("Required.", body.GetProperty("errors").GetProperty("text")[0].GetString());
    }

    [Fact]
    public async Task Bad_request_is_400_problem_with_title()
    {
        var (response, body) = await ExecuteAsync(HttpProblems.BadRequest("Malformed JSON"));

        Assert.Equal(StatusCodes.Status400BadRequest, response.StatusCode);
        Assert.StartsWith(ProblemJson, response.ContentType, StringComparison.Ordinal);
        Assert.Equal("Malformed JSON", body.GetProperty("title").GetString());
    }

    [Fact]
    public async Task Payload_too_large_is_413_problem_json()
    {
        var (response, body) = await ExecuteAsync(HttpProblems.PayloadTooLarge(16_384));

        Assert.Equal(StatusCodes.Status413PayloadTooLarge, response.StatusCode);
        Assert.StartsWith(ProblemJson, response.ContentType, StringComparison.Ordinal);
        Assert.Contains("16384", body.GetProperty("detail").GetString(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Too_many_requests_is_429_with_retry_after_in_whole_seconds()
    {
        var (response, _) = await ExecuteAsync(HttpProblems.TooManyRequests(TimeSpan.FromSeconds(59.2)));

        Assert.Equal(StatusCodes.Status429TooManyRequests, response.StatusCode);
        Assert.StartsWith(ProblemJson, response.ContentType, StringComparison.Ordinal);
        Assert.Equal("60", response.Headers.RetryAfter.ToString());
    }

    [Fact]
    public async Task Service_unavailable_is_503_problem_with_title_only()
    {
        var (response, body) = await ExecuteAsync(HttpProblems.ServiceUnavailable("Event log unavailable"));

        Assert.Equal(StatusCodes.Status503ServiceUnavailable, response.StatusCode);
        Assert.StartsWith(ProblemJson, response.ContentType, StringComparison.Ordinal);
        Assert.Equal("Event log unavailable", body.GetProperty("title").GetString());
        Assert.False(body.TryGetProperty("detail", out _));
    }
}
