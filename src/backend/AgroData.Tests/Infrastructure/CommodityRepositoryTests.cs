using AgroData.Domain.Entities;
using AgroData.Infrastructure.Repositories;
using AgroData.Tests.TestSupport;

namespace AgroData.Tests.Infrastructure;

public sealed class CommodityRepositoryTests : IDisposable
{
    private readonly SqliteTestDatabase _database = new();

    public void Dispose() => _database.Dispose();

    [Fact]
    public async Task GetRecentAsync_keeps_the_latest_quotes_of_every_symbol()
    {
        var start = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        _database.Context.Commodities.AddRange(
            Quote("SOJA", 100.0, start),
            Quote("SOJA", 110.0, start.AddHours(1)),
            Quote("SOJA", 120.0, start.AddHours(2)),
            Quote("MILHO", 50.0, start.AddHours(1)),
            Quote("MILHO", 55.0, start.AddHours(2)));
        await _database.Context.SaveChangesAsync();

        var repository = new CommodityRepository(_database.Context);
        var result = await repository.GetRecentAsync(perSymbolLimit: 2);

        Assert.Equal(4, result.Count);
        Assert.Equal(2, result.Count(quote => quote.Symbol == "SOJA"));
        Assert.Equal(
            new[] { 120.0, 110.0 },
            result.Where(quote => quote.Symbol == "SOJA").Select(quote => quote.Price));
        Assert.Equal(
            new[] { 55.0, 50.0 },
            result.Where(quote => quote.Symbol == "MILHO").Select(quote => quote.Price));
    }

    [Fact]
    public async Task GetRecentAsync_does_not_let_a_busy_symbol_starve_another()
    {
        var start = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var quotes = Enumerable
            .Range(0, 50)
            .Select(index => Quote("SOJA", 100.0 + index, start.AddMinutes(index)))
            .Append(Quote("MILHO", 60.0, start))
            .ToArray();

        _database.Context.Commodities.AddRange(quotes);
        await _database.Context.SaveChangesAsync();

        var repository = new CommodityRepository(_database.Context);
        var result = await repository.GetRecentAsync(perSymbolLimit: 3);

        Assert.Equal(3, result.Count(quote => quote.Symbol == "SOJA"));
        Assert.Single(result, quote => quote.Symbol == "MILHO");
    }

    [Fact]
    public async Task GetRecentAsync_rejects_a_non_positive_limit()
    {
        var repository = new CommodityRepository(_database.Context);

        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(
            () => repository.GetRecentAsync(0));
    }

    [Fact]
    public async Task GetRecentAsync_returns_empty_when_the_table_is_empty()
    {
        var repository = new CommodityRepository(_database.Context);

        Assert.Empty(await repository.GetRecentAsync(5));
    }

    [Fact]
    public async Task GetHistoryAsync_is_case_insensitive_and_returns_newest_first()
    {
        var start = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc);
        _database.Context.Commodities.AddRange(
            Quote("SOJA", 1.0, start),
            Quote("SOJA", 2.0, start.AddHours(1)),
            Quote("SOJA", 3.0, start.AddHours(2)),
            Quote("MILHO", 9.0, start));
        await _database.Context.SaveChangesAsync();

        var repository = new CommodityRepository(_database.Context);
        var history = await repository.GetHistoryAsync(" soja ", limit: 2);

        Assert.Equal(2, history.Count);
        Assert.Equal(new[] { 3.0, 2.0 }, history.Select(quote => quote.Price));
    }

    [Fact]
    public async Task GetHistoryAsync_returns_empty_for_an_unknown_symbol()
    {
        var repository = new CommodityRepository(_database.Context);

        Assert.Empty(await repository.GetHistoryAsync("CAFE", 10));
    }

    [Fact]
    public async Task GetHistoryAsync_requires_a_symbol()
    {
        var repository = new CommodityRepository(_database.Context);

        await Assert.ThrowsAsync<ArgumentException>(() => repository.GetHistoryAsync("  ", 10));
    }

    [Fact]
    public async Task GetByIdAsync_returns_the_quote_or_null()
    {
        var quote = Quote("SOJA", 136.42, new DateTime(2026, 3, 1, 12, 0, 0, DateTimeKind.Utc));
        _database.Context.Commodities.Add(quote);
        await _database.Context.SaveChangesAsync();

        var repository = new CommodityRepository(_database.Context);

        var found = await repository.GetByIdAsync(quote.Id);
        Assert.NotNull(found);
        Assert.Equal(136.42, found.Price);

        Assert.Null(await repository.GetByIdAsync(quote.Id + 999));
    }

    [Fact]
    public async Task Queries_do_not_track_entities()
    {
        _database.Context.Commodities.Add(Quote("SOJA", 100.0, DateTime.UtcNow));
        await _database.Context.SaveChangesAsync();

        var repository = new CommodityRepository(_database.Context);
        var quotes = await repository.GetHistoryAsync("SOJA", 10);

        Assert.All(quotes, quote =>
        {
            _database.Context.Entry(quote);
            Assert.Equal(Microsoft.EntityFrameworkCore.EntityState.Detached, _database.Context.Entry(quote).State);
        });
    }

    private static Commodity Quote(string symbol, double price, DateTime timestamp) => new()
    {
        Symbol = symbol,
        Price = price,
        Timestamp = timestamp,
        Source = "Test",
    };
}
