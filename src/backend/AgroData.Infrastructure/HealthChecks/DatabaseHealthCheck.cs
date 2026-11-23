using AgroData.Infrastructure.Context;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace AgroData.Infrastructure.HealthChecks;

/// <summary>
/// Readiness probe: verifies the API can reach PostgreSQL and read the table
/// that backs the dashboard.
/// </summary>
public sealed class DatabaseHealthCheck : IHealthCheck
{
    private readonly AppDbContext _context;

    /// <summary>Initialises a new health check.</summary>
    /// <param name="context">EF Core context.</param>
    public DatabaseHealthCheck(AppDbContext context)
    {
        _context = context;
    }

    /// <inheritdoc />
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var canConnect = await _context.Database.CanConnectAsync(cancellationToken)
                .ConfigureAwait(false);

            return canConnect
                ? HealthCheckResult.Healthy("PostgreSQL is reachable.")
                : HealthCheckResult.Unhealthy("PostgreSQL is unreachable.");
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            return HealthCheckResult.Unhealthy("PostgreSQL health check failed.", exception);
        }
    }
}
