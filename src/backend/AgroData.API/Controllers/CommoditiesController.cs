using System.Text;
using AgroData.API.Configuration;
using AgroData.API.Csv;
using AgroData.API.Http;
using AgroData.Application.Caching;
using AgroData.Application.DTOs;
using AgroData.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

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
    private readonly CachingOptions _caching;

    /// <summary>Initialises a new controller.</summary>
    /// <param name="service">Application service.</param>
    /// <param name="caching">Cache configuration, also used for HTTP cache directives.</param>
    public CommoditiesController(ICommodityService service, IOptions<CachingOptions> caching)
    {
        ArgumentNullException.ThrowIfNull(caching);

        _service = service;
        _caching = caching.Value;
    }

    /// <summary>Returns the latest snapshot of every tracked commodity.</summary>
    /// <remarks>
    /// Each item includes the previous price, the absolute and relative change,
    /// the trend and a short price history used by the sparklines.
    /// Supports conditional requests: send the returned <c>ETag</c> back as
    /// <c>If-None-Match</c> to receive <c>304 Not Modified</c> instead of a body.
    /// </remarks>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <response code="200">One snapshot per symbol, ordered by symbol.</response>
    /// <response code="304">The client cache is still valid.</response>
    /// <response code="429">Too many requests.</response>
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<CommoditySnapshotResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status304NotModified)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<IReadOnlyList<CommoditySnapshotResponse>>> GetLatest(
        CancellationToken cancellationToken)
    {
        var snapshots = await _service.GetLatestPricesAsync(cancellationToken).ConfigureAwait(false);

        var entityTag = EntityTags.ForSnapshots(snapshots);
        var lastModified = EntityTags.LastModified(snapshots);

        if (!_caching.Enabled)
        {
            Response.Headers.ETag = entityTag;
            ConditionalGet.DisableCaching(HttpContext);
            return Ok(snapshots);
        }

        var maxAge = TimeSpan.FromSeconds(_caching.SnapshotSeconds);
        return ConditionalGet.IsNotModified(HttpContext, entityTag, lastModified, maxAge)
            ? StatusCode(StatusCodes.Status304NotModified)
            : Ok(snapshots);
    }

    /// <summary>Returns the price history of a single commodity.</summary>
    /// <param name="symbol">Ticker, e.g. <c>SOJA</c>.</param>
    /// <param name="points">Number of points to return (1–500, default 30).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <response code="200">Chronological price series and its moving average.</response>
    /// <response code="304">The client cache is still valid.</response>
    /// <response code="400">The symbol is missing.</response>
    /// <response code="404">The symbol has no quotes.</response>
    [HttpGet("history")]
    [ProducesResponseType<CommodityHistoryResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status304NotModified)]
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

        if (history is null)
        {
            return Problem(
                title: "Commodity not found",
                detail: $"No quotes were found for symbol '{symbol}'.",
                statusCode: StatusCodes.Status404NotFound);
        }

        if (!_caching.Enabled)
        {
            Response.Headers.ETag = EntityTags.ForHistory(history);
            ConditionalGet.DisableCaching(HttpContext);
            return Ok(history);
        }

        var maxAge = TimeSpan.FromSeconds(_caching.HistorySeconds);
        return ConditionalGet.IsNotModified(
            HttpContext,
            EntityTags.ForHistory(history),
            EntityTags.LastModified(history),
            maxAge)
            ? StatusCode(StatusCodes.Status304NotModified)
            : Ok(history);
    }

    /// <summary>Downloads the price history as CSV.</summary>
    /// <remarks>
    /// Numbers use the invariant culture (<c>136.42</c>) and timestamps are ISO
    /// 8601 in UTC, so the file opens correctly in Excel, Sheets and pandas.
    /// </remarks>
    /// <param name="symbol">Ticker, e.g. <c>SOJA</c>.</param>
    /// <param name="points">Number of points to export (1–500, default 500).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <response code="200">A <c>text/csv</c> attachment.</response>
    /// <response code="400">The symbol is missing.</response>
    /// <response code="404">The symbol has no quotes.</response>
    [HttpGet("export")]
    [ProducesResponseType<FileContentResult>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Export(
        [FromQuery] string? symbol,
        [FromQuery] int points = MaxHistoryPoints,
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

        if (history is null)
        {
            return Problem(
                title: "Commodity not found",
                detail: $"No quotes were found for symbol '{symbol}'.",
                statusCode: StatusCodes.Status404NotFound);
        }

        var body = Encoding.UTF8.GetBytes(HistoryCsv.Write(history));
        return File(body, "text/csv; charset=utf-8", HistoryCsv.FileName(history, DateTimeOffset.UtcNow));
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
