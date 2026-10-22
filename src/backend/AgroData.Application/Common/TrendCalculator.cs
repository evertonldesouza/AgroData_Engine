using AgroData.Domain.Enums;

namespace AgroData.Application.Common;

/// <summary>
/// Pure trend and moving-average rules, extracted so they can be unit tested
/// without a database. The same rules are implemented in the Python engine
/// (<c>agrodata/analytics.py</c>).
/// </summary>
public static class TrendCalculator
{
    /// <summary>Movement (in percent) below which a price is considered stable.</summary>
    public const double FlatThresholdPercent = 0.001;

    /// <summary>Default window used by the moving average.</summary>
    public const int DefaultWindow = 7;

    /// <summary>Minimum number of observations needed to compute a moving average.</summary>
    public const int MinimumPoints = 3;

    /// <summary>
    /// Classifies the movement between two prices.
    /// </summary>
    /// <param name="latest">Most recent price.</param>
    /// <param name="previous">Previous price, <c>null</c> when unknown.</param>
    public static TrendDirection Classify(double latest, double? previous)
    {
        if (previous is not { } reference || reference == 0)
        {
            return TrendDirection.Flat;
        }

        var deltaPercent = Math.Abs((latest - reference) / reference) * 100;
        if (deltaPercent < FlatThresholdPercent)
        {
            return TrendDirection.Flat;
        }

        return latest > reference ? TrendDirection.Up : TrendDirection.Down;
    }

    /// <summary>
    /// Simple moving average of the last <paramref name="window"/> values.
    /// Returns <c>null</c> when there are fewer than
    /// <see cref="MinimumPoints"/> observations.
    /// </summary>
    public static double? MovingAverage(IReadOnlyList<double> values, int window = DefaultWindow)
    {
        if (window < 1)
        {
            throw new ArgumentOutOfRangeException(nameof(window), window, "Window must be at least 1.");
        }

        if (values.Count < Math.Min(MinimumPoints, window))
        {
            return null;
        }

        var take = Math.Min(window, values.Count);
        var sum = 0d;
        for (var i = values.Count - take; i < values.Count; i++)
        {
            sum += values[i];
        }

        return Math.Round(sum / take, 2);
    }

    /// <summary>
    /// Relative change between two prices, rounded to two decimals.
    /// </summary>
    public static double? PercentChange(double latest, double? previous)
    {
        if (previous is not { } reference || reference == 0)
        {
            return null;
        }

        return Math.Round((latest - reference) / reference * 100, 2);
    }
}
