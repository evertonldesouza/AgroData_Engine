using AgroData.Application.DTOs;

namespace AgroData.API.Http;

/// <summary>
/// Builds deterministic entity tags for the read endpoints.
/// </summary>
/// <remarks>
/// The tag is derived from the payload itself (symbols, prices and timestamps),
/// not from a server-side counter, so two instances behind a load balancer agree
/// on it and a restart does not invalidate every client cache.
/// </remarks>
public static class EntityTags
{
    private const ulong FnvOffsetBasis = 14695981039346656037UL;
    private const ulong FnvPrime = 1099511628211UL;

    /// <summary>Entity tag for the snapshot collection.</summary>
    /// <param name="snapshots">Snapshots returned by the service.</param>
    public static string ForSnapshots(IReadOnlyList<CommoditySnapshotResponse> snapshots)
    {
        ArgumentNullException.ThrowIfNull(snapshots);

        if (snapshots.Count == 0)
        {
            return "\"empty\"";
        }

        var hash = FnvOffsetBasis;
        foreach (var snapshot in snapshots.OrderBy(item => item.Symbol, StringComparer.Ordinal))
        {
            hash = Mix(hash, snapshot.Symbol);
            hash = Mix(hash, snapshot.Price);
            hash = Mix(hash, snapshot.Timestamp.Ticks);
            hash = Mix(hash, snapshot.Source);
        }

        return $"\"{hash:x16}-{snapshots.Count}\"";
    }

    /// <summary>Entity tag for a history series.</summary>
    /// <param name="history">Series returned by the service.</param>
    public static string ForHistory(CommodityHistoryResponse history)
    {
        ArgumentNullException.ThrowIfNull(history);

        var hash = Mix(FnvOffsetBasis, history.Symbol);
        foreach (var point in history.Points)
        {
            hash = Mix(hash, point.Timestamp.Ticks);
            hash = Mix(hash, point.Price);
        }

        hash = Mix(hash, history.MovingAverage ?? double.NaN);
        return $"\"{hash:x16}-{history.Points.Count}\"";
    }

    /// <summary>Most recent timestamp in the collection, as UTC.</summary>
    /// <param name="snapshots">Snapshots returned by the service.</param>
    public static DateTimeOffset? LastModified(IReadOnlyList<CommoditySnapshotResponse> snapshots)
    {
        ArgumentNullException.ThrowIfNull(snapshots);

        return snapshots.Count == 0 ? null : ToUtcOffset(snapshots.Max(item => item.Timestamp));
    }

    /// <summary>Most recent point of a series, as UTC.</summary>
    /// <param name="history">Series returned by the service.</param>
    public static DateTimeOffset? LastModified(CommodityHistoryResponse history)
    {
        ArgumentNullException.ThrowIfNull(history);

        return history.Points.Count == 0
            ? null
            : ToUtcOffset(history.Points.Max(point => point.Timestamp));
    }

    /// <summary>
    /// Treats unspecified timestamps as UTC. Npgsql returns <c>timestamptz</c> as
    /// UTC, but SQLite (used by the tests) drops the kind.
    /// </summary>
    /// <param name="timestamp">Timestamp to convert.</param>
    public static DateTimeOffset ToUtcOffset(DateTime timestamp) =>
        new(timestamp.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(timestamp, DateTimeKind.Utc)
            : timestamp.ToUniversalTime());

    private static ulong Mix(ulong hash, string value)
    {
        foreach (var character in value)
        {
            hash = (hash ^ character) * FnvPrime;
        }

        return hash;
    }

    private static ulong Mix(ulong hash, long value) => Mix(hash, unchecked((ulong)value));

    private static ulong Mix(ulong hash, double value) =>
        Mix(hash, BitConverter.DoubleToInt64Bits(Math.Round(value, 4)));

    private static ulong Mix(ulong hash, ulong value)
    {
        for (var index = 0; index < sizeof(ulong); index++)
        {
            hash = (hash ^ (value & 0xFF)) * FnvPrime;
            value >>= 8;
        }

        return hash;
    }
}
