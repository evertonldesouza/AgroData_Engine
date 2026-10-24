using AgroData.Application.DTOs;

namespace AgroData.Application.Alerts;

/// <summary>
/// Turns snapshots into alerts. Pure functions over DTOs, so the rules are
/// tested without a database, a clock or a container.
/// </summary>
public static class AlertEvaluator
{
    /// <summary>
    /// Evaluates the snapshots against the configured thresholds.
    /// </summary>
    /// <param name="snapshots">Latest snapshot per symbol.</param>
    /// <param name="options">Thresholds.</param>
    /// <returns>Alerts ordered by severity, then by absolute change.</returns>
    public static IReadOnlyList<PriceAlert> Evaluate(
        IEnumerable<CommoditySnapshotResponse> snapshots,
        AlertOptions options)
    {
        ArgumentNullException.ThrowIfNull(snapshots);
        ArgumentNullException.ThrowIfNull(options);

        if (!options.Enabled)
        {
            return [];
        }

        var threshold = Math.Max(0, options.ThresholdPercent);
        var severe = Math.Max(threshold, options.SeverePercent);

        return snapshots
            .Where(snapshot => snapshot.DeltaPercent is { } change && Math.Abs(change) >= threshold)
            .Select(snapshot => Build(snapshot, severe))
            .OrderByDescending(alert => alert.Severity)
            .ThenByDescending(alert => Math.Abs(alert.ChangePercent))
            .Take(Math.Max(1, options.MaxAlerts))
            .ToList();
    }

    private static PriceAlert Build(CommoditySnapshotResponse snapshot, double severeThreshold)
    {
        var change = snapshot.DeltaPercent ?? 0;
        var isDrop = change < 0;
        var magnitude = Math.Abs(change);

        return new PriceAlert(
            Symbol: snapshot.Symbol,
            Kind: isDrop ? AlertKind.PriceDrop : AlertKind.PriceSpike,
            Severity: magnitude >= severeThreshold ? AlertSeverity.Critical : AlertSeverity.Warning,
            Price: snapshot.Price,
            ReferencePrice: snapshot.PreviousPrice ?? snapshot.Price,
            ChangePercent: Math.Round(change, 2),
            Timestamp: snapshot.Timestamp,
            Message: FormattableString.Invariant(
                $"{snapshot.Symbol} {(isDrop ? "caiu" : "subiu")} {magnitude:0.00}% " +
                $"({snapshot.PreviousPrice ?? snapshot.Price:0.00} → {snapshot.Price:0.00})."));
    }
}
