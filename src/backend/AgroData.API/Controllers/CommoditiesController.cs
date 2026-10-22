using AgroData.API.Configuration;
using AgroData.Application.DTOs;
using AgroData.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AgroData.API.Controllers;

/// <summary>Read-only access to commodity prices.</summary>
[ApiController]
[Route("api/commodities")]
[EnableRateLimiting(ApiPolicies.PublicApi)]
public sealed class CommoditiesController : ControllerBase
{
    private const int DefaultHistoryPoints = 30;
    private const int MaxHistoryPoints = 500;

    private readonly ICommodityService _service;

    /// <summary>Initialises a new controller.</summary>
    /// <param name="service">Application service.</param>
    public CommoditiesController(ICommodityService service)
    {
        _service = service;
    }

    /// <summary>Returns the latest snapshot of every tracked commodity.</summary>
    /// <remarks>
    /// Each item includes the previous price, the absolute and relative change,
    /// the trend and a short price history used by the sparklines.
    /// </remarks>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <response code="200">One snapshot per symbol, newest first.</response>
    /// <response code="429">Too many requests.</response>
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<CommoditySnapshotResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<IReadOnlyList<CommoditySnapshotResponse>>> GetLatest(
        CancellationToken cancellationToken)
    {
        var snapshots = await _service.GetLatestPricesAsync(cancellationToken).ConfigureAwait(false);
        return Ok(snapshots);
    }

    /// <summary>Returns the price history of a single commodity.</summary>
    /// <param name="symbol">Ticker, e.g. <c>SOJA</c>.</param>
    /// <param name="points">Number of points to return (1–500, default 30).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <response code="200">Chronological price series and its moving average.</response>
    /// <response code="400">The symbol is missing.</response>
    /// <response code="404">The symbol has no quotes.</response>
    [HttpGet("history")]
    [ProducesResponseType<CommodityHistoryResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CommodityHistoryResponse>> GetHistory(
        [FromQuery] string? symbol,
        [FromQuery] int points = DefaultHistoryPoints,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(symbol))
        {
            ModelState.AddModelError(nameof(symbol), "The symbol query parameter is required.");
            return ValidationProblem(ModelState);
        }

        var history = await _service
            .GetHistoryAsync(symbol, Math.Clamp(points, 1, MaxHistoryPoints), cancellationToken)
            .ConfigureAwait(false);

        return history is null
            ? Problem(
                title: "Commodity not found",
                detail: $"No quotes were found for symbol '{symbol}'.",
                statusCode: StatusCodes.Status404NotFound)
            : Ok(history);
    }

    /// <summary>Returns a single quote by identifier.</summary>
    /// <param name="id">Quote identifier.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <response code="200">The quote.</response>
    /// <response code="404">The quote does not exist.</response>
    [HttpGet("{id:int}")]
    [ProducesResponseType<CommoditySnapshotResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CommoditySnapshotResponse>> GetById(
        int id,
        CancellationToken cancellationToken)
    {
        var snapshot = await _service.GetByIdAsync(id, cancellationToken).ConfigureAwait(false);

        return snapshot is null
            ? Problem(
                title: "Quote not found",
                detail: $"No quote exists with id {id}.",
                statusCode: StatusCodes.Status404NotFound)
            : Ok(snapshot);
    }
}
