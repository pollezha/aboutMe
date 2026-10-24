using Gateway.Api;
using Gateway.Edge;
using Gateway.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

builder.Services.AddProblemDetails();
builder.Services.AddGatewayEdge(builder.Configuration);
builder.Services.AddGatewayInfrastructure(builder.Configuration);

// Маршруты и кластеры — appsettings.json (design §5.2); адреса https+http://<svc> разрешает service discovery
builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"))
    .AddServiceDiscoveryDestinationResolver();

var app = builder.Build();

// Порядок: адрес клиента → внутренний /health → маршрут → CORS → дешёвые отказы по маршруту (бот, размер тела)
// до лимитера, чтобы они не тратили разрешения посетителя → лимитер → прокси
app.UseExceptionHandler();
app.UseForwardedHeaders();
app.UseInternalHealthHostFilter();
app.UseRouting();
app.UseCors();
app.UseBotFilter();
app.UseBodyLimits();
app.UseRateLimiter();

app.MapHealthEndpoints();
app.MapReverseProxy();

app.Run();
