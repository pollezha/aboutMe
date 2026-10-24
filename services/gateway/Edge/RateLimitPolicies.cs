using System.Threading.RateLimiting;
using BuildingBlocks.Http;
using Gateway.Edge.Options;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace Gateway.Edge;

// Лимиты по IP посетителя (design §5.2); политики привязаны к маршрутам YARP через RateLimiterPolicy.
internal static class RateLimitPolicies
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
                ClientAddress.PartitionKey(context),
                _ => new ConcurrencyLimiterOptions { PermitLimit = Limits(context).Hubs.PermitLimit, QueueLimit = 0 }));
        });
    }

    private static RateLimitOptions Limits(HttpContext context) =>
        context.RequestServices.GetRequiredService<IOptions<RateLimitOptions>>().Value;

    private static RateLimitPartition<string> FixedWindow(HttpContext context, FixedWindowLimit limit) =>
        RateLimitPartition.GetFixedWindowLimiter(
            ClientAddress.PartitionKey(context),
            _ => new FixedWindowRateLimiterOptions { PermitLimit = limit.PermitLimit, Window = limit.Window, QueueLimit = 0 });

    // Окно фиксированного лимита известно — Retry-After; у лимита одновременных соединений его нет
    private static async ValueTask WriteRejectionAsync(OnRejectedContext rejected, CancellationToken cancellationToken)
    {
        var problem = rejected.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter)
            ? HttpProblems.TooManyRequests(retryAfter)
            : HttpProblems.TooManyRequests();

        await problem.ExecuteAsync(rejected.HttpContext);
    }
}
