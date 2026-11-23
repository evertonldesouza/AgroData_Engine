namespace AgroData.Application.DTOs;

/// <summary>A single point of the price history series.</summary>
/// <param name="Timestamp">Capture time (UTC).</param>
/// <param name="Price">Price in BRL per 60 kg bag.</param>
public sealed record PricePointResponse(DateTime Timestamp, double Price);

/// <summary>Price history of a symbol, used by the market chart.</summary>
/// <param name="Symbol">Ticker of the commodity.</param>
/// <param name="Points">Chronological series, oldest first.</param>
/// <param name="MovingAverage">Simple moving average of the last window, when enough data exists.</param>
/// <param name="Window">Number of points used by the moving average.</param>
public sealed record CommodityHistoryResponse(
    string Symbol,
    IReadOnlyList<PricePointResponse> Points,
    double? MovingAverage,
    int Window);
