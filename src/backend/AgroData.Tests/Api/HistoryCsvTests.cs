using AgroData.API.Csv;
using AgroData.Application.DTOs;

namespace AgroData.Tests.Api;

public sealed class HistoryCsvTests
{
    [Fact]
    public void Writes_a_header_and_one_row_per_point()
    {
        var csv = HistoryCsv.Write(History("SOJA", (136.42, "2026-10-22T12:00:00Z"), (134.2, "2026-10-22T11:00:00Z")));

        var lines = csv.Split('\n', StringSplitOptions.RemoveEmptyEntries);

        Assert.Equal("timestamp,symbol,price", lines[0]);
        Assert.Equal("2026-10-22T12:00:00Z,SOJA,136.42", lines[1]);
        Assert.Equal("2026-10-22T11:00:00Z,SOJA,134.20", lines[2]);
    }

    [Fact]
    public void Uses_a_dot_as_decimal_separator_regardless_of_culture()
    {
        var previous = System.Globalization.CultureInfo.CurrentCulture;
        try
        {
            System.Globalization.CultureInfo.CurrentCulture = new System.Globalization.CultureInfo("pt-BR");

            var csv = HistoryCsv.Write(History("SOJA", (1234.5, "2026-10-22T12:00:00Z")));

            Assert.Contains("SOJA,1234.50", csv);
            Assert.DoesNotContain("1234,50", csv);
        }
        finally
        {
            System.Globalization.CultureInfo.CurrentCulture = previous;
        }
    }

    [Fact]
    public void Escapes_symbols_that_contain_separators()
    {
        var csv = HistoryCsv.Write(History("SOJA,PARANÁ", (1, "2026-10-22T12:00:00Z")));

        Assert.Contains("\"SOJA,PARANÁ\",1.00", csv);
    }

    [Fact]
    public void Escapes_quotes()
    {
        var csv = HistoryCsv.Write(History("SO\"JA", (1, "2026-10-22T12:00:00Z")));

        Assert.Contains("\"SO\"\"JA\"", csv);
    }

    [Fact]
    public void Treats_unspecified_timestamps_as_utc()
    {
        var history = new CommodityHistoryResponse(
            "SOJA",
            [new PricePointResponse(new DateTime(2026, 10, 22, 12, 0, 0, DateTimeKind.Unspecified), 10)],
            null,
            0);

        Assert.Contains("2026-10-22T12:00:00Z", HistoryCsv.Write(history));
    }

    [Fact]
    public void Suggest_a_file_name_with_the_symbol_and_last_quote()
    {
        var history = History("SOJA", (1, "2026-10-22T12:00:00Z"));

        Assert.Equal("agrodata-SOJA-20261022-1200.csv", HistoryCsv.FileName(history, DateTimeOffset.UtcNow));
    }

    [Fact]
    public void Handles_an_empty_series()
    {
        var history = new CommodityHistoryResponse("SOJA", [], null, 0);

        Assert.Equal("timestamp,symbol,price\n", HistoryCsv.Write(history));
        Assert.EndsWith(".csv", HistoryCsv.FileName(history, DateTimeOffset.UtcNow), StringComparison.Ordinal);
    }

    private static CommodityHistoryResponse History(
        string symbol,
        params (double Price, string Timestamp)[] points) =>
        new(
            symbol,
            [.. points.Select(point => new PricePointResponse(
                DateTime.Parse(point.Timestamp, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.AdjustToUniversal | System.Globalization.DateTimeStyles.AssumeUniversal),
                point.Price))],
            null,
            0);
}
