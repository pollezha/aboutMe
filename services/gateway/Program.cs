using Gateway.Health;
using Gateway.Policies;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

builder.Services.AddProblemDetails();
builder.Services.AddGatewayForwardedHeaders();
builder.Services.AddGatewayCors();
builder.Services.AddGatewayRateLimiting(builder.Configuration);
builder.Services.Configure<BotFilterOptions>(builder.Configuration.GetSection(BotFilterOptions.SectionName));
builder.Services.AddBackendHealthChecks(builder.Configuration);

// Маршруты и кластеры — appsettings.json (design §5.2); адреса https+http://<svc> разрешает service discovery
builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"))
    .AddServiceDiscoveryDestinationResolver();

var app = builder.Build();

app.UseExceptionHandler();
app.UseForwardedHeaders();
app.UseInternalHealthEndpoint();
app.UseRouting();
app.UseCors();
app.UseBotEventFilter();
app.UseRequestBodyLimit();
app.UseRateLimiter();

app.MapDefaultEndpoints();
app.MapReverseProxy();

app.Run();
