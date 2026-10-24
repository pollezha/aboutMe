using EventsApi.Api;
using EventsApi.Application;
using EventsApi.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// До AddServiceDefaults: редактор токена должен стоять в конвейере спанов раньше OTLP-экспортёра
builder.Services.AddEventsApiSpanRedaction();
builder.AddServiceDefaults();
builder.Services.AddProblemDetails();
builder.Services.AddEventsApiApplication();
builder.AddEventsApiInfrastructure();

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();

app.MapDefaultEndpoints();
app.MapEventsEndpoint();
app.MapMessagesEndpoint();

app.Run();
