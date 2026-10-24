using System.ComponentModel.DataAnnotations;

namespace AgroData.Application.Alerts;

/// <summary>
/// Rules that decide when a price movement deserves attention, bound from the
/// <c>Alerts</c> configuration section.
/// </summary>
public sealed class AlertOptions
{
    /// <summary>Configuration section name.</summary>
    public const string SectionName = "Alerts";

    /// <summary>Turns the alert evaluation off.</summary>
    public bool Enabled { get; init; } = true;

    /// <summary>Absolute change (in percent) that raises a warning.</summary>
    [Range(0.1, 100)]
    public double ThresholdPercent { get; init; } = 1.5;

    /// <summary>Absolute change (in percent) that raises a critical alert.</summary>
    [Range(0.1, 100)]
    public double SeverePercent { get; init; } = 3.0;

    /// <summary>How many alerts the endpoint may return at once.</summary>
    [Range(1, 50)]
    public int MaxAlerts { get; init; } = 10;
}
