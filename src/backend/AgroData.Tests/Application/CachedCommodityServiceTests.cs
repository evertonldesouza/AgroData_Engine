using AgroData.Application.Caching;
using AgroData.Application.DTOs;
using AgroData.Application.Interfaces;
using AgroData.Domain.Enums;
using AgroData.Tests.TestSupport;
using Moq;

namespace AgroData.Tests.Application;

public sealed class CachedCommodityServiceTests
{
    private readonly ManualTimeProvider _time = new();
    private readonly Mock<ICommodityService> _inner = new(MockBehavior.Strict);
    private readonly CachedCommodityService _service;

    public CachedCommodityServiceTests()
    {
        var caches = new CommodityCaches(
            new TtlCache<string, IReadOnlyList<CommoditySnapshotResponse>>(
                _time,
                TimeSpan.FromSeconds(20)),
            new TtlCache<string, CommodityHistoryResponse?>(_time, TimeSpan.FromSeconds(60)));

        _service = new CachedCommodityService(_inner.Object, caches);
    }

    [Fact]
    public async Task Snapshots_are_loaded_once_within_the_ttl()
    {
        _inner
            .Setup(service => service.GetLatestPricesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync([Snapshot()]);

        await _service.GetLatestPricesAsync();
        await _service.GetLatestPricesAsync();

        _inner.Verify(
            service => service.GetLatestPricesAsync(It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Snapshots_are_reloaded_after_the_ttl()
    {
        _inner
            .Setup(service => service.GetLatestPricesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync([Snapshot()]);

        await _service.GetLatestPricesAsync();
        _time.AdvanceSeconds(21);
        await _service.GetLatestPricesAsync();

        _inner.Verify(
            service => service.GetLatestPricesAsync(It.IsAny<CancellationToken>()),
            Times.Exactly(2));
    }

    [Fact]
    public async Task Concurrent_snapshot_requests_hit_the_loader_once()
    {
        _inner
            .Setup(service => service.GetLatestPricesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync([Snapshot()]);

        await Task.WhenAll(Enumerable.Range(0, 10).Select(_ => _service.GetLatestPricesAsync()));

        _inner.Verify(
            service => service.GetLatestPricesAsync(It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Single_quotes_are_not_cached()
    {
        _inner
            .Setup(service => service.GetByIdAsync(7, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Snapshot());

        await _service.GetByIdAsync(7);
        await _service.GetByIdAsync(7);

        _inner.Verify(service => service.GetByIdAsync(7, It.IsAny<CancellationToken>()), Times.Exactly(2));
    }

    [Fact]
    public async Task History_is_cached_per_symbol_and_point_count()
    {
        _inner
            .Setup(service => service.GetHistoryAsync(It.IsAny<string>(), 30, It.IsAny<CancellationToken>()))
            .ReturnsAsync(History("SOJA"));
        _inner
            .Setup(service => service.GetHistoryAsync(It.IsAny<string>(), 60, It.IsAny<CancellationToken>()))
            .ReturnsAsync(History("SOJA"));

        await _service.GetHistoryAsync("soja", 30);
        await _service.GetHistoryAsync(" SOJA ", 30);
        await _service.GetHistoryAsync("SOJA", 60);

        _inner.Verify(service => service.GetHistoryAsync("soja", 30, It.IsAny<CancellationToken>()), Times.Once);

        // The second call hits the cache: the normalised key is shared, so the
        // differently-spelled symbol never reaches the repository again.
        _inner.Verify(service => service.GetHistoryAsync(" SOJA ", 30, It.IsAny<CancellationToken>()), Times.Never);
        _inner.Verify(service => service.GetHistoryAsync("SOJA", 60, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Missing_history_is_cached_as_null()
    {
        _inner
            .Setup(service => service.GetHistoryAsync("CAFE", 30, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CommodityHistoryResponse?)null);

        Assert.Null(await _service.GetHistoryAsync("CAFE", 30));
        Assert.Null(await _service.GetHistoryAsync("CAFE", 30));

        _inner.Verify(service => service.GetHistoryAsync("CAFE", 30, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Blank_symbols_bypass_the_cache()
    {
        _inner
            .Setup(service => service.GetHistoryAsync("  ", 30, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CommodityHistoryResponse?)null);

        await _service.GetHistoryAsync("  ", 30);
        await _service.GetHistoryAsync("  ", 30);

        _inner.Verify(
            service => service.GetHistoryAsync("  ", 30, It.IsAny<CancellationToken>()),
            Times.Exactly(2));
    }

    private static CommoditySnapshotResponse Snapshot() => new(
        Id: 1,
        Symbol: "SOJA",
        Price: 136.42,
        PreviousPrice: 134.21,
        Delta: 2.21,
        DeltaPercent: 1.65,
        Trend: TrendDirection.Up,
        Timestamp: new DateTime(2026, 10, 22, 12, 0, 0, DateTimeKind.Utc),
        Source: "Test",
        History: [134.21, 136.42]);

    private static CommodityHistoryResponse History(string symbol) => new(
        Symbol: symbol,
        Points: [new PricePointResponse(new DateTime(2026, 10, 22, 12, 0, 0, DateTimeKind.Utc), 136.42)],
        MovingAverage: 136.42,
        Window: 1);
}
