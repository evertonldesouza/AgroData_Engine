using AgroData.Application.Common;
using AgroData.Application.DTOs;
using AgroData.Application.Interfaces;
using AgroData.Domain.Entities;
using AgroData.Domain.Interfaces;

namespace AgroData.Application.Services;

/// <summary>
/// Default implementation of <see cref="ICommodityService"/>.
/// </summary>
/// <remarks>
/// The service owns the projection from entities to DTOs and all price math;
/// the repository only knows how to fetch rows.
/// </remarks>
public sealed class CommodityService : ICommodityService
{
    /// <summary>How many quotes per symbol are loaded to build a snapshot.</summary>
    internal const int HistoryDepth = 24;

    private const int DefaultHistoryPoints = 30;
    private const int MaxHistoryPoints = 500;

    private readonly ICommodityRepository _repository;

    /// <summary>Initialises a new service.</summary>
    /// <param name="repository">Read access to the warehouse.</param>
    public CommodityService(ICommodityRepository repository)
    {
        _repository = repository;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<CommoditySnapshotResponse>> GetLatestPricesAsync(
        CancellationToken cancellationToken = default)
    {
        var rows = await _repository.GetRecentAsync(HistoryDepth, cancellationToken);

        return rows
            .GroupBy(row => row.Symbol, StringComparer.OrdinalIgnoreCase)
            .Select(group => BuildSnapshot(group))
            .OrderBy(snapshot => snapshot.Symbol, StringComparer.Ordinal)
            .ToList();
    }

    /// <inheritdoc />
    public async Task<CommoditySnapshotResponse?> GetByIdAsync(
        int id,
        CancellationToken cancellationToken = default)
    {
        var entity = await _repository.GetByIdAsync(id, cancellationToken);
        return entity is null ? null : BuildSnapshot([entity]);
    }

    /// <inheritdoc />
    public async Task<CommodityHistoryResponse?> GetHistoryAsync(
        string symbol,
        int points,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(symbol))
        {
            return null;
        }

        var size = Math.Clamp(points <= 0 ? DefaultHistoryPoints : points, 1, MaxHistoryPoints);
        var rows = await _repository.GetHistoryAsync(symbol.Trim(), size, cancellationToken);
        if (rows.Count == 0)
        {
            return null;
        }

        var ordered = rows.OrderBy(row => row.Timestamp).ToList();
        var prices = ordered.Select(row => Math.Round(row.Price, 2)).ToList();

        return new CommodityHistoryResponse(
            Symbol: ordered[0].Symbol,
            Points: ordered
                .Select(row => new PricePointResponse(row.Timestamp, Math.Round(row.Price, 2)))
                .ToList(),
            MovingAverage: TrendCalculator.MovingAverage(prices),
            Window: Math.Min(TrendCalculator.DefaultWindow, prices.Count));
    }

    private static CommoditySnapshotResponse BuildSnapshot(IEnumerable<Commodity> rows)
    {
        var ordered = rows.OrderByDescending(row => row.Timestamp).ThenByDescending(row => row.Id).ToList();
        var latest = ordered[0];
        var previous = ordered.Count > 1 ? ordered[1] : null;

        var delta = previous is null ? (double?)null : Math.Round(latest.Price - previous.Price, 2);
        var history = ordered
            .Take(HistoryDepth)
            .Reverse()
            .Select(row => Math.Round(row.Price, 2))
            .ToList();

        return new CommoditySnapshotResponse(
            Id: latest.Id,
            Symbol: latest.Symbol.ToUpperInvariant(),
            Price: Math.Round(latest.Price, 2),
            PreviousPrice: previous is null ? null : Math.Round(previous.Price, 2),
            Delta: delta,
            DeltaPercent: TrendCalculator.PercentChange(latest.Price, previous?.Price),
            Trend: TrendCalculator.Classify(latest.Price, previous?.Price),
            Timestamp: latest.Timestamp,
            Source: latest.Source,
            History: history);
    }
}
