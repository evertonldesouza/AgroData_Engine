using AgroData.Domain.Enums;

namespace AgroData.Application.DTOs;

/// <summary>
/// Latest market snapshot of a commodity, as consumed by the dashboard.
/// </summary>
/// <param name="Id">Identifier of the most recent quote.</param>
/// <param name="Symbol">Ticker, e.g. <c>SOJA</c>.</param>
/// <param name="Price">Latest price in BRL per 60 kg bag.</param>
/// <param name="PreviousPrice">Previous price, when a previous quote exists.</param>
/// <param name="Delta">Absolute change between the last two quotes.</param>
/// <param name="DeltaPercent">Relative change, in percent.</param>
/// <param name="Trend">Direction of the movement.</param>
/// <param name="Timestamp">Capture time of the latest quote.</param>
/// <param name="Source">Origin of the quote.</param>
/// <param name="History">Most recent prices, oldest first (sparkline data).</param>
public sealed record CommoditySnapshotResponse(
    int Id,
    string Symbol,
    double Price,
    double? PreviousPrice,
    double? Delta,
    double? DeltaPercent,
    TrendDirection Trend,
    DateTime Timestamp,
    string Source,
    IReadOnlyList<double> History);
