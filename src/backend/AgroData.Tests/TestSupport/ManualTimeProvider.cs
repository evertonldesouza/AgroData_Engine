namespace AgroData.Tests.TestSupport;

/// <summary>
/// Deterministic clock: tests move time forward explicitly instead of sleeping.
/// </summary>
internal sealed class ManualTimeProvider : TimeProvider
{
    private DateTimeOffset _now;

    public ManualTimeProvider(DateTimeOffset? start = null) =>
        _now = start ?? new DateTimeOffset(2026, 10, 22, 12, 0, 0, TimeSpan.Zero);

    public override DateTimeOffset GetUtcNow() => _now;

    public void Advance(TimeSpan delta) => _now = _now.Add(delta);

    public void AdvanceSeconds(double seconds) => Advance(TimeSpan.FromSeconds(seconds));
}
