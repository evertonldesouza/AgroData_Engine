using AgroData.Application.Alerts;
using AgroData.Application.DTOs;
using AgroData.Domain.Enums;
using AgroData.Tests.TestSupport;
using Moq;

namespace AgroData.Tests.Application;

public sealed class AlertEvaluatorTests
{
    private static readonly AlertOptions Options = new()
    {
        Enabled = true,
        ThresholdPercent = 1.5,
        SeverePercent = 3.0,
        MaxAlerts = 10,
    };

    [Fact]
    public void Ignores_movements_below_the_threshold()
    {
        var alerts = AlertEvaluator.Evaluate([Snapshot("SOJA", 100, 0.5)], Options);

        Assert.Empty(alerts);
    }

    [Fact]
    public void Raises_a_warning_above_the_threshold()
    {
        var alerts = AlertEvaluator.Evaluate([Snapshot("SOJA", 102, 2.0)], Options);

        var alert = Assert.Single(alerts);
        Assert.Equal(AlertKind.PriceSpike, alert.Kind);
        Assert.Equal(AlertSeverity.Warning, alert.Severity);
        Assert.Equal(2.0, alert.ChangePercent);
        Assert.Contains("subiu", alert.Message);
    }

    [Fact]
    public void Escalates_to_critical_above_the_severe_threshold()
    {
        var alerts = AlertEvaluator.Evaluate([Snapshot("MILHO", 96, -4.0)], Options);

        var alert = Assert.Single(alerts);
        Assert.Equal(AlertSeverity.Critical, alert.Severity);
        Assert.Equal(AlertKind.PriceDrop, alert.Kind);
        Assert.Contains("caiu", alert.Message);
    }

    [Fact]
    public void Sorts_by_severity_then_magnitude()
    {
        var alerts = AlertEvaluator.Evaluate(
            [
                Snapshot("MILHO", 100, 1.6),
                Snapshot("SOJA", 100, 3.5),
                Snapshot("CAFE", 100, -2.2),
                Snapshot("BOI", 100, -3.9),
            ],
            Options);

        Assert.Equal(["BOI", "SOJA", "CAFE", "MILHO"], alerts.Select(alert => alert.Symbol));
    }

    [Fact]
    public void Respects_the_maximum_number_of_alerts()
    {
        var options = new AlertOptions { MaxAlerts = 2, ThresholdPercent = 1.5, SeverePercent = 3 };

        var alerts = AlertEvaluator.Evaluate(
            [Snapshot("A", 100, 2), Snapshot("B", 100, 3), Snapshot("C", 100, 4)],
            options);

        Assert.Equal(2, alerts.Count);
    }

    [Fact]
    public void Returns_nothing_when_disabled()
    {
        var options = new AlertOptions { Enabled = false };

        Assert.Empty(AlertEvaluator.Evaluate([Snapshot("SOJA", 100, 10)], options));
    }

    [Fact]
    public void Skips_snapshots_without_a_previous_quote()
    {
        var snapshot = new CommoditySnapshotResponse(
            Id: 1,
            Symbol: "SOJA",
            Price: 100,
            PreviousPrice: null,
            Delta: null,
            DeltaPercent: null,
            Trend: TrendDirection.Flat,
            Timestamp: DateTime.UtcNow,
            Source: "Test",
            History: [100]);

        Assert.Empty(AlertEvaluator.Evaluate([snapshot], Options));
    }

    [Fact]
    public async Task Alert_service_reads_the_snapshots()
    {
        var commodities = new Mock<AgroData.Application.Interfaces.ICommodityService>();
        commodities
            .Setup(service => service.GetLatestPricesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync([Snapshot("SOJA", 100, 4.2)]);

        var service = new AlertService(
            commodities.Object,
            Microsoft.Extensions.Options.Options.Create(Options));

        var alerts = await service.GetActiveAlertsAsync();

        var alert = Assert.Single(alerts);
        Assert.Equal(AlertSeverity.Critical, alert.Severity);
    }

    private static CommoditySnapshotResponse Snapshot(string symbol, double price, double changePercent) =>
        new(
            Id: 1,
            Symbol: symbol,
            Price: price,
            PreviousPrice: Math.Round(price / (1 + (changePercent / 100)), 2),
            Delta: Math.Round(price - (price / (1 + (changePercent / 100))), 2),
            DeltaPercent: changePercent,
            Trend: changePercent >= 0 ? TrendDirection.Up : TrendDirection.Down,
            Timestamp: new DateTime(2026, 10, 22, 12, 0, 0, DateTimeKind.Utc),
            Source: "Test",
            History: [price]);
}
