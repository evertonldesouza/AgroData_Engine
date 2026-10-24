using AgroData.Application.Interfaces;
using Microsoft.Extensions.Options;

namespace AgroData.Application.Alerts;

/// <summary>Reads the active alerts.</summary>
public interface IAlertService
{
    /// <summary>Returns the price movements that crossed the configured thresholds.</summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task<IReadOnlyList<PriceAlert>> GetActiveAlertsAsync(CancellationToken cancellationToken = default);
}

/// <inheritdoc />
/// <remarks>
/// Alerts are derived from the snapshot use case rather than stored in a table:
/// the rule is "how much did the last quote move", which the snapshot already
/// answers. Persisting them would add a write path (and a migration) for data
/// that can be recomputed in microseconds.
/// </remarks>
public sealed class AlertService : IAlertService
{
    private readonly ICommodityService _commodities;
    private readonly AlertOptions _options;

    /// <summary>Initialises the service.</summary>
    /// <param name="commodities">Snapshot use case.</param>
    /// <param name="options">Thresholds.</param>
    public AlertService(ICommodityService commodities, IOptions<AlertOptions> options)
    {
        ArgumentNullException.ThrowIfNull(commodities);
        ArgumentNullException.ThrowIfNull(options);

        _commodities = commodities;
        _options = options.Value;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<PriceAlert>> GetActiveAlertsAsync(
        CancellationToken cancellationToken = default)
    {
        var snapshots = await _commodities.GetLatestPricesAsync(cancellationToken).ConfigureAwait(false);
        return AlertEvaluator.Evaluate(snapshots, _options);
    }
}
