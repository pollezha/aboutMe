using System.Globalization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace Gateway.Policies;

internal sealed class RateLimitOptions
{
    public const string SectionName = "RateLimits";

    public FixedWindowLimit Events { get; init; } = new();

    public FixedWindowLimit Messages { get; init; } = new();

    public ConcurrencyLimit Hubs { get; init; } = new();
}

internal sealed class FixedWindowLimit
{
    public int PermitLimit { get; init; }

    public TimeSpan Window { get; init; }
}

internal sealed class ConcurrencyLimit
{
    public int PermitLimit { get; init; }
}

// Лимиты по IP посетителя (design §5.2); политики привязаны к маршрутам YARP через RateLimiterPolicy.
// IP живёт только в памяти лимитера как ключ партиции и не логируется.
internal static class RateLimiting
{
    public const string Events = "events";
    public const string Messages = "messages";
    public const string Hubs = "hubs";

    public static IServiceCollection AddGatewayRateLimiting(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<RateLimitOptions>(configuration.GetSection(RateLimitOptions.SectionName));

        return services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = WriteRejectionAsync;

            options.AddPolicy(Events, context => FixedWindow(context, Limits(context).Events));
            options.AddPolicy(Messages, context => FixedWindow(context, Limits(context).Messages));
            options.AddPolicy(Hubs, context => RateLimitPartition.GetConcurrencyLimiter(
                ClientKey(context),
                _ => new ConcurrencyLimiterOptions { PermitLimit = Limits(context).Hubs.PermitLimit, QueueLimit = 0 }));
        });
    }

    private static RateLimitOptions Limits(HttpContext context) =>
        context.RequestServices.GetRequiredService<IOptions<RateLimitOptions>>().Value;

    private static RateLimitPartition<string> FixedWindow(HttpContext context, FixedWindowLimit limit) =>
        RateLimitPartition.GetFixedWindowLimiter(
            ClientKey(context),
            _ => new FixedWindowRateLimiterOptions { PermitLimit = limit.PermitLimit, Window = limit.Window, QueueLimit = 0 });

    // Адрес после ForwardedHeaders: X-Forwarded-For учитывается только от доверенного прокси
    private static string ClientKey(HttpContext context)
    {
        var address = context.Connection.RemoteIpAddress;
        if (address is null)
        {
            return "unknown";
        }

        return (address.IsIPv4MappedToIPv6 ? address.MapToIPv4() : address).ToString();
    }

    private static async ValueTask WriteRejectionAsync(OnRejectedContext rejected, CancellationToken cancellationToken)
    {
        var context = rejected.HttpContext;
        if (rejected.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            context.Response.Headers.RetryAfter =
                ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString(CultureInfo.InvariantCulture);
        }

        await context.RequestServices.GetRequiredService<IProblemDetailsService>().WriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            ProblemDetails =
            {
                Status = StatusCodes.Status429TooManyRequests,
                Title = "Too many requests",
            },
        });
    }
}
