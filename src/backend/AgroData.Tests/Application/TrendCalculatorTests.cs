using AgroData.Application.Common;
using AgroData.Domain.Enums;

namespace AgroData.Tests.Application;

public sealed class TrendCalculatorTests
{
    [Theory]
    [InlineData(140.0, 135.0, TrendDirection.Up)]
    [InlineData(135.0, 140.0, TrendDirection.Down)]
    [InlineData(135.0, 135.0, TrendDirection.Flat)]
    [InlineData(135.0, null, TrendDirection.Flat)]
    [InlineData(135.0, 0.0, TrendDirection.Flat)]
    public void Classify_returns_the_expected_direction(
        double latest,
        double? previous,
        TrendDirection expected)
    {
        Assert.Equal(expected, TrendCalculator.Classify(latest, previous));
    }

    [Fact]
    public void Classify_treats_negligible_moves_as_flat()
    {
        Assert.Equal(TrendDirection.Flat, TrendCalculator.Classify(100.05, 100.0));
    }

    [Fact]
    public void MovingAverage_is_null_below_the_minimum_number_of_points()
    {
        Assert.Null(TrendCalculator.MovingAverage([100.0, 101.0]));
        Assert.Null(TrendCalculator.MovingAverage([]));
    }

    [Fact]
    public void MovingAverage_uses_only_the_last_window()
    {
        double? average = TrendCalculator.MovingAverage([10.0, 10.0, 20.0, 30.0, 40.0], window: 3);

        Assert.Equal(30.0, average);
    }

    [Fact]
    public void MovingAverage_rounds_to_two_decimals()
    {
        Assert.Equal(100.33, TrendCalculator.MovingAverage([100.0, 100.5, 100.5]));
    }

    [Fact]
    public void MovingAverage_rejects_an_impossible_window()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => TrendCalculator.MovingAverage([1.0], window: 0));
    }

    [Theory]
    [InlineData(110.0, 100.0, 10.0)]
    [InlineData(90.0, 100.0, -10.0)]
    [InlineData(100.0, null, null)]
    [InlineData(100.0, 0.0, null)]
    public void PercentChange_handles_edges(double latest, double? previous, double? expected)
    {
        Assert.Equal(expected, TrendCalculator.PercentChange(latest, previous));
    }
}
