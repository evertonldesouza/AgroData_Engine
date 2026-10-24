using AgroData.API.Configuration;
using AgroData.Application.Alerts;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AgroData.API.Controllers;

/// <summary>Price movements that crossed the configured thresholds.</summary>
[ApiController]
[Route("api/alerts")]
[EnableRateLimiting(ApiPolicies.PublicApi)]
public sealed class AlertsController : ControllerBase
{
    private readonly IAlertService _alerts;

    /// <summary>Initialises a new controller.</summary>
    /// <param name="alerts">Alert use case.</param>
    public AlertsController(IAlertService alerts)
    {
        _alerts = alerts;
    }

    /// <summary>Returns the active alerts, most severe first.</summary>
    /// <remarks>
    /// An alert is raised when the latest quote moved more than
    /// <c>Alerts:ThresholdPercent</c> against the previous one. Severity escalates
    /// to <c>critical</c> above <c>Alerts:SeverePercent</c>. The list is empty when
    /// nothing crossed the threshold — that is a healthy response, not an error.
    /// </remarks>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <response code="200">Zero or more alerts.</response>
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<PriceAlert>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<IReadOnlyList<PriceAlert>>> GetActive(
        CancellationToken cancellationToken)
    {
        var alerts = await _alerts.GetActiveAlertsAsync(cancellationToken).ConfigureAwait(false);

        // Alerts change with the quotes, which are already cached; a short
        // client cache keeps the dashboard from re-requesting on every render.
        Response.Headers.CacheControl = "public, max-age=15, stale-while-revalidate=30";
        return Ok(alerts);
    }
}
