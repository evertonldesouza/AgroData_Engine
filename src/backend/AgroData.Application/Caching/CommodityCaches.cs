using AgroData.Application.DTOs;

namespace AgroData.Application.Caching;

/// <summary>
/// Holds the cache instances shared by every request.
/// </summary>
/// <remarks>
/// Registered as a singleton: the caches must outlive the scoped services that
/// use them, otherwise every request would start with an empty cache.
/// </remarks>
public sealed class CommodityCaches
{
    /// <summary>Initialises the shared caches.</summary>
    /// <param name="snapshots">Cache for <c>GET /api/commodities</c>.</param>
    /// <param name="history">Cache for <c>GET /api/commodities/history</c>.</param>
    public CommodityCaches(
        TtlCache<string, IReadOnlyList<CommoditySnapshotResponse>> snapshots,
        TtlCache<string, CommodityHistoryResponse?> history)
    {
        ArgumentNullException.ThrowIfNull(snapshots);
        ArgumentNullException.ThrowIfNull(history);

        Snapshots = snapshots;
        History = history;
    }

    /// <summary>Key used for the (single) snapshot entry.</summary>
    public const string SnapshotKey = "latest";

    /// <summary>Snapshot cache.</summary>
    public TtlCache<string, IReadOnlyList<CommoditySnapshotResponse>> Snapshots { get; }

    /// <summary>History cache, keyed by <c>SYMBOL:points</c>; a missing symbol is
    /// cached as <c>null</c> for the same short window.</summary>
    public TtlCache<string, CommodityHistoryResponse?> History { get; }
}
