namespace AgroData.Application.Alerts;

/// <summary>How urgent an alert is.</summary>
public enum AlertSeverity
{
    /// <summary>Worth a look.</summary>
    Info = 0,

    /// <summary>Moved beyond the configured threshold.</summary>
    Warning = 1,

    /// <summary>Moved beyond the severe threshold.</summary>
    Critical = 2,
}

/// <summary>Which direction the price moved.</summary>
public enum AlertKind
{
    /// <summary>Price dropped.</summary>
    PriceDrop = 0,

    /// <summary>Price rose.</summary>
    PriceSpike = 1,
}

/// <summary>
/// A price movement that crossed the configured threshold.
/// </summary>
/// <param name="Symbol">Ticker, e.g. <c>SOJA</c>.</param>
/// <param name="Kind">Direction of the movement.</param>
/// <param name="Severity">Urgency.</param>
/// <param name="Price">Latest price.</param>
/// <param name="ReferencePrice">Previous price used for the comparison.</param>
/// <param name="ChangePercent">Relative change, signed.</param>
/// <param name="Timestamp">When the latest quote was captured.</param>
/// <param name="Message">Human readable summary in Portuguese.</param>
public sealed record PriceAlert(
    string Symbol,
    AlertKind Kind,
    AlertSeverity Severity,
    double Price,
    double ReferencePrice,
    double ChangePercent,
    DateTime Timestamp,
    string Message);
