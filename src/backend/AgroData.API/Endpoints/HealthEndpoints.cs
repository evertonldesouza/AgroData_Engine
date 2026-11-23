using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace AgroData.API.Endpoints;

/// <summary>Liveness and readiness probes.</summary>
public static class HealthEndpoints
{
    /// <summary>Tag applied to checks that need the database.</summary>
    public const string ReadyTag = "ready";

    /// <summary>Maps <c>/health</c>, <c>/health/live</c> and <c>/health/ready</c>.</summary>
    /// <param name="app">Application builder.</param>
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        // Aggregate status: used by the dashboard badge and by uptime monitors.
        app.MapHealthChecks(
                "/health",
                new HealthCheckOptions { ResponseWriter = WriteResponse })
            .AllowAnonymous();

        // Liveness: the process is up. Never touches the database.
        app.MapHealthChecks(
                "/health/live",
                new HealthCheckOptions { Predicate = _ => false })
            .AllowAnonymous();

        // Readiness: dependencies required to serve traffic are healthy.
        app.MapHealthChecks(
                "/health/ready",
                new HealthCheckOptions
                {
                    Predicate = registration => registration.Tags.Contains(ReadyTag),
                    ResponseWriter = WriteResponse,
                })
            .AllowAnonymous();

        return app;
    }

    private static Task WriteResponse(HttpContext context, HealthReport report)
    {
        context.Response.ContentType = "application/json; charset=utf-8";

        var payload = new
        {
            status = report.Status.ToString().ToLowerInvariant(),
            totalDurationMs = (int)report.TotalDuration.TotalMilliseconds,
            checks = report.Entries.Select(entry => new
            {
                name = entry.Key,
                status = entry.Value.Status.ToString().ToLowerInvariant(),
                description = entry.Value.Description,
                durationMs = (int)entry.Value.Duration.TotalMilliseconds,
            }),
        };

        return context.Response.WriteAsync(
            JsonSerializer.Serialize(payload, JsonSerializerOptions.Web));
    }
}
