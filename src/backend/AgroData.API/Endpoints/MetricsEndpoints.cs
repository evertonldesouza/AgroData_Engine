using AgroData.API.Observability;

namespace AgroData.API.Endpoints;

/// <summary>Prometheus-compatible metrics endpoint.</summary>
public static class MetricsEndpoints
{
    /// <summary>Content type expected by Prometheus scrapers (text format 0.0.4).</summary>
    public const string ContentType = "text/plain; version=0.0.4; charset=utf-8";

    /// <summary>Maps <c>GET /metrics</c>.</summary>
    /// <param name="app">Application builder.</param>
    public static IEndpointRouteBuilder MapMetricsEndpoints(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        app.MapGet(
                "/metrics",
                (RequestMetrics metrics) => Results.Text(metrics.Render(), ContentType))
            .AllowAnonymous()
            .WithTags("observability")
            .WithSummary("Métricas de requisição em formato Prometheus.");

        return app;
    }
}
