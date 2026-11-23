using AgroData.Domain.Entities;

namespace AgroData.Tests.TestSupport;

/// <summary>Fluent builder that keeps the price-math tests readable.</summary>
internal sealed class QuoteBuilder
{
    private readonly List<Commodity> _quotes = [];

    private QuoteBuilder()
    {
    }

    public static QuoteBuilder Create() => new();

    public QuoteBuilder With(string symbol, double price, DateTime? timestamp = null, int id = 0) =>
        Add(symbol, price, timestamp ?? DateTime.UtcNow, id);

    public QuoteBuilder Series(string symbol, params double[] prices)
    {
        var start = DateTime.UtcNow.AddHours(-prices.Length);
        for (var index = 0; index < prices.Length; index++)
        {
            Add(symbol, prices[index], start.AddHours(index), index + 1);
        }

        return this;
    }

    public IReadOnlyList<Commodity> Build() => _quotes;

    private QuoteBuilder Add(string symbol, double price, DateTime timestamp, int id)
    {
        _quotes.Add(new Commodity
        {
            Id = id,
            Symbol = symbol,
            Price = price,
            Timestamp = timestamp,
            Source = "Test",
        });

        return this;
    }
}
