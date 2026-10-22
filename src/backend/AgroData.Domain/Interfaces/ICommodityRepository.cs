using AgroData.Domain.Entities;

namespace AgroData.Domain.Interfaces;

/// <summary>
/// Read access to the commodity price history.
/// </summary>
/// <remarks>
/// The write side lives in the Python data engine, so this contract is
/// read-only by design: the API never mutates the warehouse.
/// </remarks>
public interface ICommodityRepository
{
    /// <summary>
    /// Returns the most recent quotes, keeping at most
    /// <paramref name="perSymbolLimit"/> rows for each symbol.
    /// </summary>
    /// <param name="perSymbolLimit">Maximum number of quotes per symbol.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task<IReadOnlyList<Commodity>> GetRecentAsync(
        int perSymbolLimit,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns the price history of a single symbol, newest last.
    /// </summary>
    /// <param name="symbol">Ticker, case insensitive.</param>
    /// <param name="limit">Maximum number of points.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task<IReadOnlyList<Commodity>> GetHistoryAsync(
        string symbol,
        int limit,
        CancellationToken cancellationToken = default);

    /// <summary>Finds a single quote by its identifier.</summary>
    /// <param name="id">Surrogate key.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task<Commodity?> GetByIdAsync(int id, CancellationToken cancellationToken = default);
}
