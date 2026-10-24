using BuildingBlocks.Messaging.Kafka;
using Contracts.Events;
using LiveHub.Application;
using LiveHub.Infrastructure;
using LiveHub.Workers;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
builder.Services.AddLiveHubApplication();
builder.AddLiveHubInfrastructure();

builder.Services.AddSingleton<LiveBroadcastWorker>();
builder.Services.AddHostedService(services => services.GetRequiredService<LiveBroadcastWorker>());
builder.Services.AddSingleton<IKafkaMessageHandler<SiteEvent>, LiveEventsMessageHandler>();
builder.Services.AddHostedService<LiveConsumerWorker>();

var app = builder.Build();

app.MapDefaultEndpoints();
app.MapHub<LiveHub.Api.Hubs.LiveHub>(LiveHub.Api.Hubs.LiveHub.Path);

app.Run();
