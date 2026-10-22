using AgroData.Application.Services;
using AgroData.Domain.Entities;
using AgroData.Domain.Enums;
using AgroData.Domain.Interfaces;
using AgroData.Tests.TestSupport;
using Moq;

namespace AgroData.Tests.Application;

public sealed class CommodityServiceTests
{
    private readonly Mock<ICommodityRepository> _repository = new(MockBehavior.Strict);
    private readonly CommodityService _service;

    public CommodityServiceTests()
    {
        _service = new CommodityService(_repository.Object);
    }

    [Fact]
    public async Task GetLatestPricesAsync_returns_one_snapshot_per_symbol_with_trends()
    {
        var quotes = QuoteBuilder.Create()
            .Series("SOJA", 135.0, 140.0)
            .Series("MILHO", 60.0, 55.0)
            .Build();

        _repository
            .Setup(repository => repository.GetRecentAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(quotes);

        var result = await _service.GetLatestPricesAsync();

        Assert.Equal(2, result.Count);
        var soja = Assert.Single(result, snapshot => snapshot.Symbol == "SOJA");
        Assert.Equal(140.0, soja.Price);
        Assert.Equal(135.0, soja.PreviousPrice);
        Assert.Equal(5.0, soja.Delta);
        Assert.Equal(3.7, soja.DeltaPercent);
        Assert.Equal(TrendDirection.Up, soja.Trend);

        var milho = Assert.Single(result, snapshot => snapshot.Symbol == "MILHO");
        Assert.Equal(TrendDirection.Down, milho.Trend);
        Assert.Equal(-8.33, milho.DeltaPercent);
    }

    [Fact]
    public async Task GetLatestPricesAsync_is_flat_when_only_one_quote_exists()
    {
        var quotes = QuoteBuilder.Create().With("SOJA", 136.0).Build();

        _repository
            .Setup(repository => repository.GetRecentAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(quotes);

        var snapshot = Assert.Single(await _service.GetLatestPricesAsync());

        Assert.Equal(TrendDirection.Flat, snapshot.Trend);
        Assert.Null(snapshot.PreviousPrice);
        Assert.Null(snapshot.Delta);
        Assert.Null(snapshot.DeltaPercent);
        Assert.NotEmpty(snapshot.History);
    }

    [Fact]
    public async Task GetLatestPricesAsync_returns_an_empty_list_when_the_warehouse_is_empty()
    {
        _repository
            .Setup(repository => repository.GetRecentAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        Assert.Empty(await _service.GetLatestPricesAsync());
    }

    [Fact]
    public async Task GetLatestPricesAsync_builds_ascending_history_and_orders_newest_first()
    {
        var now = DateTime.UtcNow;
        var quotes = QuoteBuilder.Create()
            .With("SOJA", 130.0, now.AddHours(-2))
            .With("SOJA", 132.0, now.AddHours(-1))
            .With("SOJA", 134.0, now)
            .With("MILHO", 58.0, now.AddHours(-5))
            .Build();

        _repository
            .Setup(repository => repository.GetRecentAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(quotes);

        var result = await _service.GetLatestPricesAsync();

        Assert.Equal("MILHO", result[0].Symbol);
        Assert.Equal("SOJA", result[1].Symbol);
        Assert.Equal(new[] { 130.0, 132.0, 134.0 }, result[1].History);
    }

    [Fact]
    public async Task GetLatestPricesAsync_passes_the_cancellation_token_to_the_repository()
    {
        using var source = new CancellationTokenSource();

        _repository
            .Setup(repository => repository.GetRecentAsync(
                It.IsAny<int>(),
                It.Is<CancellationToken>(token => token == source.Token)))
            .ReturnsAsync([]);

        await _service.GetLatestPricesAsync(source.Token);

        _repository.Verify(
            repository => repository.GetRecentAsync(It.IsAny<int>(), source.Token),
            Times.Once);
    }

    [Fact]
    public async Task GetByIdAsync_returns_null_when_the_quote_does_not_exist()
    {
        _repository
            .Setup(repository => repository.GetByIdAsync(42, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Commodity?)null);

        Assert.Null(await _service.GetByIdAsync(42));
    }

    [Fact]
    public async Task GetByIdAsync_maps_the_entity()
    {
        _repository
            .Setup(repository => repository.GetByIdAsync(7, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Commodity
            {
                Id = 7,
                Symbol = "soja",
                Price = 136.42,
                Timestamp = DateTime.UtcNow,
                Source = "Test",
            });

        var snapshot = await _service.GetByIdAsync(7);

        Assert.NotNull(snapshot);
        Assert.Equal("SOJA", snapshot.Symbol);
        Assert.Equal(136.42, snapshot.Price);
        Assert.Equal(TrendDirection.Flat, snapshot.Trend);
        Assert.Equal(new[] { 136.42 }, snapshot.History);
    }

    [Fact]
    public async Task GetHistoryAsync_returns_null_for_a_blank_symbol()
    {
        Assert.Null(await _service.GetHistoryAsync("   ", 30));
        _repository.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task GetHistoryAsync_returns_null_when_there_are_no_quotes()
    {
        _repository
            .Setup(repository => repository.GetHistoryAsync("CAFE", It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        Assert.Null(await _service.GetHistoryAsync("CAFE", 30));
    }

    [Fact]
    public async Task GetHistoryAsync_clamps_the_number_of_points()
    {
        _repository
            .Setup(repository => repository.GetHistoryAsync(
                "SOJA",
                It.Is<int>(points => points == 500),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        await _service.GetHistoryAsync("SOJA", points: 10_000);

        _repository.VerifyAll();
    }

    [Fact]
    public async Task GetHistoryAsync_returns_chronological_points_and_the_moving_average()
    {
        var now = DateTime.UtcNow;
        var quotes = QuoteBuilder.Create()
            .With("SOJA", 120.0, now.AddHours(-2))
            .With("SOJA", 130.0, now.AddHours(-1))
            .With("SOJA", 140.0, now)
            .Build();

        _repository
            .Setup(repository => repository.GetHistoryAsync("SOJA", 30, It.IsAny<CancellationToken>()))
            .ReturnsAsync([.. quotes.Reverse()]);

        var history = await _service.GetHistoryAsync("SOJA", 30);

        Assert.NotNull(history);
        Assert.Equal("SOJA", history.Symbol);
        Assert.Equal(new[] { 120.0, 130.0, 140.0 }, history.Points.Select(point => point.Price));
        Assert.Equal(130.0, history.MovingAverage);
        Assert.True(history.Points[0].Timestamp < history.Points[^1].Timestamp);
    }
}
