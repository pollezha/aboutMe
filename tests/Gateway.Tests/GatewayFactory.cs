using System.Collections.Concurrent;
using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Yarp.ReverseProxy.Forwarder;

namespace Gateway.Tests;

// Gateway с заглушками бэкендов: YARP и health-клиент ходят в StubBackends вместо сети.
// Каждый тест создаёт свою фабрику — состояние лимитера и кэша health не переживает тест.
public sealed class GatewayFactory(IDictionary<string, string?>? settings = null) : WebApplicationFactory<Program>
{
    // Адрес «посетителя» по умолчанию; заголовок X-Test-Remote-Ip подменяет его для отдельного запроса
    public const string RemoteIpHeader = "X-Test-Remote-Ip";
    public static readonly IPAddress DefaultRemoteIp = IPAddress.Parse("203.0.113.10");

    public StubBackends Backends { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Поверх appsettings.json (UseSetting попал бы в конфиг хоста с меньшим приоритетом)
        builder.ConfigureAppConfiguration(config => config.AddInMemoryCollection(settings ?? new Dictionary<string, string?>()));

        builder.ConfigureTestServices(services =>
        {
            services.AddSingleton<IForwarderHttpClientFactory>(new StubForwarderHttpClientFactory(Backends));
            services.AddHttpClient(Gateway.Infrastructure.Health.BackendHealthClient.HttpClientName)
                .ConfigurePrimaryHttpMessageHandler(() => new StubHandler(Backends));
            services.AddSingleton<IStartupFilter, RemoteIpStartupFilter>();
        });
    }

    // TestServer не заполняет RemoteIpAddress — ставим его так, как это сделал бы Kestrel
    private sealed class RemoteIpStartupFilter : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            app.Use((context, nextMiddleware) =>
            {
                context.Connection.RemoteIpAddress = context.Request.Headers.TryGetValue(RemoteIpHeader, out var ip)
                    ? IPAddress.Parse(ip.ToString())
                    : DefaultRemoteIp;
                context.Request.Headers.Remove(RemoteIpHeader);
                return nextMiddleware(context);
            });
            next(app);
        };
    }

    private sealed class StubForwarderHttpClientFactory(StubBackends backends) : IForwarderHttpClientFactory
    {
        public HttpMessageInvoker CreateClient(ForwarderHttpClientContext context) => new(new StubHandler(backends));
    }

    private sealed class StubHandler(StubBackends backends) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            backends.HandleAsync(request, cancellationToken);
    }
}

// Бэкенды по имени сервиса (первая метка хоста: content-api, events-api, live-hub, projector).
// Без настроенного ответа — 200 с телом "Healthy".
public sealed class StubBackends
{
    private readonly ConcurrentDictionary<string, Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>>> responders = new();
    private readonly ConcurrentDictionary<string, int> calls = new();

    public void Respond(string service, Func<HttpRequestMessage, HttpResponseMessage> responder) =>
        responders[service] = (request, _) => Task.FromResult(responder(request));

    public void Respond(string service, Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> responder) =>
        responders[service] = responder;

    public int CallsTo(string service) => calls.GetValueOrDefault(service);

    public Task<HttpResponseMessage> HandleAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var service = request.RequestUri!.Host.Split('.')[0];
        calls.AddOrUpdate(service, 1, (_, count) => count + 1);

        return responders.TryGetValue(service, out var responder)
            ? responder(request, cancellationToken)
            : Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("Healthy") });
    }
}
