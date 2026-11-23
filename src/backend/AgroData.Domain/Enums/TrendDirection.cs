namespace AgroData.Domain.Enums;

/// <summary>
/// Direction of the latest price movement compared to the previous quote.
/// </summary>
public enum TrendDirection
{
    /// <summary>Price did not move (or there is no previous quote).</summary>
    Flat = 0,

    /// <summary>Price moved up.</summary>
    Up = 1,

    /// <summary>Price moved down.</summary>
    Down = 2,
}
