var builder = DistributedApplication.CreateBuilder(args);

builder.AddProject<Projects.Gateway>("gateway")
    .WithHttpHealthCheck("/health");

builder.Build().Run();
