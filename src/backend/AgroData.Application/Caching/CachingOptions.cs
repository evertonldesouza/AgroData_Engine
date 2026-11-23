using System.ComponentModel.DataAnnotations;

namespace AgroData.Application.Caching;

/// <summary>
/// Tuning knobs for the read-through cache, bound from the <c>Caching</c> section.
/// </summary>
/// <remarks>
/// Defaults assume an hourly ingestion: 20 seconds is enough to collapse the
/// polling of every connected dashboard into a handful of queries, while keeping
/// a newly ingested quote visible almost immediately.
/// </remarks>
public sealed class CachingOptions
{
    /// <summary>Configuration section name.</summary>
    public const string SectionName = "Caching";

    /// <summary>Turns the cache off (useful to debug data freshness).</summary>
    public bool Enabled { get; init; } = true;

    /// <summary>Time to live of the snapshot endpoint, in seconds.</summary>
    [Range(0, 3600)]
    public int SnapshotSeconds { get; init; } = 20;

    /// <summary>Time to live of the history endpoint, in seconds.</summary>
    [Range(0, 3600)]
    public int HistorySeconds { get; init; } = 60;
}
