using AgroData.Application.DTOs;

namespace AgroData.Application.Interfaces;

/// <summary>Use cases exposed to the API layer.</summary>
public interface ICommodityService
{
    /// <summary>Returns one snapshot per tracked symbol.</summary>
    Task<IReadOnlyList<CommoditySnapshotResponse>> GetLatestPricesAsync(
        CancellationToken cancellationToken = default);

    /// <summary>Returns a single quote by id, or <c>null</c> when it does not exist.</summary>
    Task<CommoditySnapshotResponse?> GetByIdAsync(int id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns the price history of <paramref name="symbol"/>, or <c>null</c> when
    /// the symbol is unknown or has no quotes.
    /// </summary>
    Task<CommodityHistoryResponse?> GetHistoryAsync(
        string symbol,
        int points,
        CancellationToken cancellationToken = default);
}
