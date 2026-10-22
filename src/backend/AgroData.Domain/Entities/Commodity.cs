namespace AgroData.Domain.Entities;

/// <summary>
/// A single commodity price observation.
/// </summary>
/// <remarks>
/// The property names are part of the database contract (see the EF Core
/// migration <c>InitialSupabase</c>): the Python ingestion engine writes to the
/// same columns, so renaming anything here is a breaking change.
/// </remarks>
public class Commodity
{
    /// <summary>Surrogate key.</summary>
    public int Id { get; set; }

    /// <summary>Ticker of the commodity, e.g. <c>SOJA</c> or <c>MILHO</c>.</summary>
    public string Symbol { get; set; } = string.Empty;

    /// <summary>Quoted price in BRL per 60 kg bag.</summary>
    public double Price { get; set; }

    /// <summary>Moment the quote was captured (UTC).</summary>
    public DateTime Timestamp { get; set; }

    /// <summary>Where the quote came from, e.g. <c>Simulated Market Data</c>.</summary>
    public string Source { get; set; } = "Simulated";
}
