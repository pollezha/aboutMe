using System.Text;
using BuildingBlocks.Http;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace BuildingBlocks.Tests.Http;

public sealed class RequestBodyReaderTests
{
    private const int Limit = 10_000;

    private static DefaultHttpContext RequestWith(byte[] body, bool declareLength = true)
    {
        var context = new DefaultHttpContext();
        context.Request.Body = new MemoryStream(body);
        if (declareLength)
        {
            context.Request.ContentLength = body.Length;
        }

        return context;
    }

    [Theory]
    [InlineData(1)]
    [InlineData(4096)]
    [InlineData(Limit)]
    public async Task Body_within_limit_is_read_completely(int size)
    {
        var body = Enumerable.Range(0, size).Select(i => (byte)(i % 251)).ToArray();
        var context = RequestWith(body);

        var result = await RequestBodyReader.ReadAsync(context.Request, Limit, TestContext.Current.CancellationToken);

        Assert.Equal(BodyReadStatus.Ok, result.Status);
        Assert.Equal(body, result.Body.ToArray());
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Body_one_byte_over_limit_is_too_large(bool declareLength)
    {
        var context = RequestWith(new byte[Limit + 1], declareLength);

        var result = await RequestBodyReader.ReadAsync(context.Request, Limit, TestContext.Current.CancellationToken);

        Assert.Equal(BodyReadStatus.TooLarge, result.Status);
        Assert.True(result.Body.IsEmpty);
    }

    [Fact]
    public async Task Declared_length_over_limit_is_too_large_without_reading()
    {
        var context = RequestWith(Encoding.UTF8.GetBytes("{}"));
        context.Request.ContentLength = Limit + 1;

        var result = await RequestBodyReader.ReadAsync(context.Request, Limit, TestContext.Current.CancellationToken);

        Assert.Equal(BodyReadStatus.TooLarge, result.Status);
        Assert.Equal(0, context.Request.Body.Position);
    }

    [Fact]
    public async Task Empty_body_is_empty()
    {
        var context = RequestWith([]);

        var result = await RequestBodyReader.ReadAsync(context.Request, Limit, TestContext.Current.CancellationToken);

        Assert.Equal(BodyReadStatus.Empty, result.Status);
        Assert.True(result.Body.IsEmpty);
    }

    [Fact]
    public async Task Server_body_size_limit_is_reported_as_too_large()
    {
        var context = new DefaultHttpContext();
        context.Request.Body = new ThrowingStream(
            new BadHttpRequestException("Request body too large.", StatusCodes.Status413PayloadTooLarge));

        var result = await RequestBodyReader.ReadAsync(context.Request, Limit, TestContext.Current.CancellationToken);

        Assert.Equal(BodyReadStatus.TooLarge, result.Status);
    }

    [Fact]
    public async Task Non_positive_limit_is_rejected()
    {
        var context = RequestWith([1]);

        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() =>
            RequestBodyReader.ReadAsync(context.Request, 0, TestContext.Current.CancellationToken));
    }

    private sealed class ThrowingStream(Exception exception) : MemoryStream
    {
        public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default) =>
            ValueTask.FromException<int>(exception);
    }
}
