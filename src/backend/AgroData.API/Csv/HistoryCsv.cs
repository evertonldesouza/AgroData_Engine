using System.Globalization;
using System.Text;
using AgroData.Application.DTOs;

namespace AgroData.API.Csv;

/// <summary>
/// Renders a price history as CSV.
/// </summary>
/// <remarks>
/// Culture invariance is the whole point here: a Brazilian workstation would
/// otherwise write <c>136,42</c>, and the decimal comma breaks every consumer
/// that expects RFC 4180 style data.
/// </remarks>
public static class HistoryCsv
{
    /// <summary>Header row written before the data.</summary>
    public const string Header = "timestamp,symbol,price";

    /// <summary>
    /// Creates the CSV body (LF line endings, ISO 8601 timestamps in UTC).
    /// </summary>
    /// <param name="history">Series to render.</param>
    public static string Write(CommodityHistoryResponse history)
    {
        ArgumentNullException.ThrowIfNull(history);

        var builder = new StringBuilder(Header.Length + 1 + (history.Points.Count * 40));
        builder.Append(Header).Append('\n');

        foreach (var point in history.Points)
        {
            builder
                .Append(FormatTimestamp(point.Timestamp))
                .Append(',')
                .Append(Escape(history.Symbol))
                .Append(',')
                .Append(point.Price.ToString("0.00", CultureInfo.InvariantCulture))
                .Append('\n');
        }

        return builder.ToString();
    }

    /// <summary>Suggests a file name for the download.</summary>
    /// <param name="history">Series being exported.</param>
    /// <param name="now">Current time, injectable for tests.</param>
    public static string FileName(CommodityHistoryResponse history, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(history);

        var lastPoint = history.Points.Count > 0
            ? history.Points[^1].Timestamp
            : now.UtcDateTime;

        return FormattableString.Invariant(
            $"agrodata-{history.Symbol.ToUpperInvariant()}-{lastPoint:yyyyMMdd-HHmm}.csv");
    }

    private static string FormatTimestamp(DateTime timestamp)
    {
        var utc = timestamp.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(timestamp, DateTimeKind.Utc)
            : timestamp.ToUniversalTime();

        return utc.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture);
    }

    private static string Escape(string value) =>
        value.Contains(',') || value.Contains('"')
            ? $"\"{value.Replace("\"", "\"\"", StringComparison.Ordinal)}\""
            : value;
}
