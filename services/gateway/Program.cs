var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

// Маршруты к сервисам появятся в этапе 4 (docs/design/architecture.md §5.2)
builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

var app = builder.Build();

app.MapDefaultEndpoints();
app.MapReverseProxy();

app.Run();
