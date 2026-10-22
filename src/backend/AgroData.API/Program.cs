using AgroData.API.Configuration;
using AgroData.API.Endpoints;
using AgroData.API.Extensions;
using AgroData.Application;
using AgroData.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// Hosting platforms such as Render inject the port to listen on.
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(port))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

builder.Services
    .AddApiServices(builder.Configuration)
    .AddApplication()
    .AddInfrastructure(builder.Configuration);

var app = builder.Build();

// Order matters: exception handling and compression wrap everything else.
app.UseExceptionHandler();
app.UseResponseCompression();
app.UseCors(ApiPolicies.FrontendCors);
app.UseRateLimiter();

// The API documentation is intentionally public: the dashboard and this
// endpoint are the two entry points recruiters/reviewers are expected to open.
app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "AgroData API v1");
    options.DocumentTitle = "AgroData Engine API";
});

app.MapControllers();
app.MapHealthEndpoints();

app.Run();

/// <summary>Entry point marker used by the integration test host.</summary>
public partial class Program
{
}
