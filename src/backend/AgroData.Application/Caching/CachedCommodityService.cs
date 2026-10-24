using AgroData.Application.DTOs;
using AgroData.Application.Interfaces;

namespace AgroData.Application.Caching;

/// <summary>
/// Read-through cache in front of <see cref="ICommodityService"/>.
/// </summary>
/// <remarks>
/// A decorator instead of cache calls inside the service: the business rules stay
/// ignorant of caching, and the cache can be switched off through configuration
/// without touching the code path that matters.
/// </remarks>
public sealed class CachedCommodityService : ICommodityService
{
    private readonly ICommodityService _inner;
    private readonly CommodityCaches _caches;

    /// <summary>Initialises the decorator.</summary>
    /// <param name="inner">Service that talks to the repository.</param>
    /// <param name="caches">Shared cache instances.</param>
    public CachedCommodityService(ICommodityService inner, CommodityCaches caches)
    {
        ArgumentNullException.ThrowIfNull(inner);
        ArgumentNullException.ThrowIfNull(caches);

        _inner = inner;
        _caches = caches;
    }

    /// <inheritdoc />
    public Task<IReadOnlyList<CommoditySnapshotResponse>> GetLatestPricesAsync(
        CancellationToken cancellationToken = default) =>
        _caches.Snapshots.GetOrCreateAsync(
            CommodityCaches.SnapshotKey,
            token => _inner.GetLatestPricesAsync(token),
            cancellationToken);

    /// <inheritdoc />
    /// <remarks>
    /// A single quote is cheap and rarely requested on its own (the dashboard does
    /// not use it), so it is intentionally not cached: a stale "by id" answer is
    /// more confusing than useful.
    /// </remarks>
    public Task<CommoditySnapshotResponse?> GetByIdAsync(
        int id,
        CancellationToken cancellationToken = default) =>
        _inner.GetByIdAsync(id, cancellationToken);

    /// <inheritdoc />
    /// <remarks>An unknown symbol is cached as <c>null</c> for the same short
    /// window, which stops a typo in the dashboard from hammering the database.</remarks>
    public Task<CommodityHistoryResponse?> GetHistoryAsync(
        string symbol,
        int points,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(symbol))
        {
            return _inner.GetHistoryAsync(symbol, points, cancellationToken);
        }

        var key = $"{symbol.Trim().ToUpperInvariant()}:{points}";

        return _caches.History.GetOrCreateAsync(
            key,
            token => _inner.GetHistoryAsync(symbol, points, token),
            cancellationToken);
    }
}
