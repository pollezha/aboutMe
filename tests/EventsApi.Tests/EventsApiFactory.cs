using System.Collections.Concurrent;
using System.Net;
using Contracts.Events;
using EventsApi.Application.Abstractions;
using EventsApi.Infrastructure.Messaging;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;

namespace EventsApi.Tests;

/// <summary>
/// events-api без брокера: продюсер — фейк, часы — ручные, логи собираются FakeLogger'ом, у запросов есть
/// «реальный» IP клиента (чтобы проверить, что он никуда не утекает).
/// </summary>
public sealed class EventsApiFactory : WebApplicationFactory<Program>
{
    public static readonly DateTimeOffset Now = new(2026, 10, 20, 12, 0, 0, TimeSpan.Zero);
    public static readonly IPAddress ClientIp = IPAddress.Parse("203.0.113.77");

    public FakeEventProducer Producer { get; } = new();

    public ManualTimeProvider Clock { get; } = new(Now);

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Адрес недоступного брокера: настоящий продюсер в этих тестах не создаётся
        builder.UseSetting("ConnectionStrings:kafka", "localhost:9");
        builder.UseSetting("Logging:LogLevel:Default", "Trace");
        builder.UseSetting("Logging:LogLevel:Microsoft.AspNetCore", "Trace");

        builder.ConfigureTestServices(services =>
        {
            // Брокера нет: создание топика при старте только ждало бы таймаут
            services.Remove(services.Single(sd => sd.ImplementationType == typeof(TopicInitializer)));
            services.RemoveAll<IEventPublisher>();
            services.AddSingleton<IEventPublisher>(Producer);
            services.RemoveAll<TimeProvider>();
            services.AddSingleton<TimeProvider>(Clock);
            services.AddFakeLogging();
            services.AddSingleton<IStartupFilter, ClientIpStartupFilter>();
        });
    }

    private sealed class ClientIpStartupFilter : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            app.Use((context, nextMiddleware) =>
            {
                context.Connection.RemoteIpAddress = ClientIp;
                return nextMiddleware(context);
            });
            next(app);
        };
    }
}

public sealed class FakeEventProducer : IEventPublisher
{
    public ConcurrentQueue<SiteEvent> Produced { get; } = new();

    public Exception? Failure { get; set; }

    public Task PublishAsync(SiteEvent siteEvent, CancellationToken cancellationToken)
    {
        if (Failure is not null)
        {
            return Task.FromException(Failure);
        }

        Produced.Enqueue(siteEvent);
        return Task.CompletedTask;
    }
}
