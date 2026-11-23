using AgroData.Domain.Entities;
using AgroData.Domain.Interfaces;
using AgroData.Infrastructure.Context;
using Microsoft.EntityFrameworkCore;

namespace AgroData.Infrastructure.Repositories;

/// <inheritdoc />
public sealed class CommodityRepository : ICommodityRepository
{
    /// <summary>
    /// Upper bound on the number of symbols queried one by one. Keeps the
    /// per-symbol query pattern bounded even if the table grows unexpectedly.
    /// </summary>
    internal const int MaxTrackedSymbols = 32;

    private readonly AppDbContext _context;

    /// <summary>Initialises a new repository.</summary>
    /// <param name="context">EF Core context.</param>
    public CommodityRepository(AppDbContext context)
    {
        _context = context;
    }

    /// <inheritdoc />
    /// <remarks>
    /// One indexed query per symbol is used instead of <c>ROW_NUMBER()</c> so the
    /// query stays portable (PostgreSQL in production, SQLite in tests) and every
    /// symbol is guaranteed to contribute its own latest quotes. The trade-off is
    /// documented in <c>docs/adr/0003-per-symbol-queries.md</c>.
    /// </remarks>
    public async Task<IReadOnlyList<Commodity>> GetRecentAsync(
        int perSymbolLimit,
        CancellationToken cancellationToken = default)
    {
        if (perSymbolLimit < 1)
        {
            throw new ArgumentOutOfRangeException(
                nameof(perSymbolLimit), perSymbolLimit, "At least one quote per symbol is required.");
        }

        var symbols = await _context
            .Commodities.AsNoTracking()
            .Select(commodity => commodity.Symbol)
            .Distinct()
            .OrderBy(symbol => symbol)
            .Take(MaxTrackedSymbols)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var result = new List<Commodity>(symbols.Count * perSymbolLimit);

        foreach (var symbol in symbols)
        {
            var quotes = await _context
                .Commodities.AsNoTracking()
                .Where(commodity => commodity.Symbol == symbol)
                .OrderByDescending(commodity => commodity.Timestamp)
                .ThenByDescending(commodity => commodity.Id)
                .Take(perSymbolLimit)
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);

            result.AddRange(quotes);
        }

        return result;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<Commodity>> GetHistoryAsync(
        string symbol,
        int limit,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(symbol))
        {
            throw new ArgumentException("Symbol is required.", nameof(symbol));
        }

        var normalized = symbol.Trim().ToUpperInvariant();

        return await _context
            .Commodities.AsNoTracking()
            .Where(commodity => commodity.Symbol == normalized)
            .OrderByDescending(commodity => commodity.Timestamp)
            .ThenByDescending(commodity => commodity.Id)
            .Take(Math.Clamp(limit, 1, 500))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task<Commodity?> GetByIdAsync(int id, CancellationToken cancellationToken = default) =>
        await _context
            .Commodities.AsNoTracking()
            .FirstOrDefaultAsync(commodity => commodity.Id == id, cancellationToken)
            .ConfigureAwait(false);
}
