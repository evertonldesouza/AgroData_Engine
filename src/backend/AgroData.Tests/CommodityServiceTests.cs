using AgroData.Application.DTOs;
using AgroData.Application.Interfaces;
using AgroData.Application.Services;
using AgroData.Domain.Entities;
using AgroData.Domain.Interfaces;
using Moq;

namespace AgroData.Tests;

public class CommodityServiceTests
{
    private readonly Mock<ICommodityRepository> _repoMock;
    private readonly ICommodityService _service;

    public CommodityServiceTests()
    {
        _repoMock = new Mock<ICommodityRepository>();
        _service = new CommodityService(_repoMock.Object);
    }

    [Fact]
    public async Task GetLatestPricesAsync_Returns_Trend_Alta_Quando_Preco_Sobe()
    {
        _repoMock.Setup(r => r.GetAllAsync(It.IsAny<int>())).ReturnsAsync(new List<Commodity>
        {
            new() { Symbol = "SOJA", Price = 140.0, Timestamp = DateTime.UtcNow.AddMinutes(-5) },
            new() { Symbol = "SOJA", Price = 135.0, Timestamp = DateTime.UtcNow.AddMinutes(-10) },
        });

        var result = (await _service.GetLatestPricesAsync()).ToList();

        Assert.Single(result);
        Assert.Equal("SOJA", result[0].Symbol);
        Assert.Equal(140.0, result[0].Price);
        Assert.Equal("Alta", result[0].Trend);
    }

    [Fact]
    public async Task GetLatestPricesAsync_Returns_Trend_Baixa_Quando_Preco_Cai()
    {
        _repoMock.Setup(r => r.GetAllAsync(It.IsAny<int>())).ReturnsAsync(new List<Commodity>
        {
            new() { Symbol = "MILHO", Price = 55.0, Timestamp = DateTime.UtcNow.AddMinutes(-5) },
            new() { Symbol = "MILHO", Price = 60.0, Timestamp = DateTime.UtcNow.AddMinutes(-10) },
        });

        var result = (await _service.GetLatestPricesAsync()).ToList();

        Assert.Single(result);
        Assert.Equal("MILHO", result[0].Symbol);
        Assert.Equal(55.0, result[0].Price);
        Assert.Equal("Baixa", result[0].Trend);
    }

    [Fact]
    public async Task GetLatestPricesAsync_Returns_Trend_Estavel_Quando_Preco_Igual()
    {
        _repoMock.Setup(r => r.GetAllAsync(It.IsAny<int>())).ReturnsAsync(new List<Commodity>
        {
            new() { Symbol = "SOJA", Price = 135.0, Timestamp = DateTime.UtcNow.AddMinutes(-5) },
            new() { Symbol = "SOJA", Price = 135.0, Timestamp = DateTime.UtcNow.AddMinutes(-10) },
        });

        var result = (await _service.GetLatestPricesAsync()).ToList();

        Assert.Single(result);
        Assert.Equal("Estável", result[0].Trend);
    }

    [Fact]
    public async Task GetLatestPricesAsync_Returns_Estavel_Quando_Ha_Apenas_Um_Registro()
    {
        _repoMock.Setup(r => r.GetAllAsync(It.IsAny<int>())).ReturnsAsync(new List<Commodity>
        {
            new() { Symbol = "SOJA", Price = 135.0, Timestamp = DateTime.UtcNow },
        });

        var result = (await _service.GetLatestPricesAsync()).ToList();

        Assert.Single(result);
        Assert.Equal("Estável", result[0].Trend);
    }

    [Fact]
    public async Task GetLatestPricesAsync_Agrupa_Por_Symbol()
    {
        _repoMock.Setup(r => r.GetAllAsync(It.IsAny<int>())).ReturnsAsync(new List<Commodity>
        {
            new() { Symbol = "SOJA", Price = 140.0, Timestamp = DateTime.UtcNow.AddMinutes(-5) },
            new() { Symbol = "SOJA", Price = 135.0, Timestamp = DateTime.UtcNow.AddMinutes(-10) },
            new() { Symbol = "MILHO", Price = 60.0, Timestamp = DateTime.UtcNow.AddMinutes(-5) },
            new() { Symbol = "MILHO", Price = 65.0, Timestamp = DateTime.UtcNow.AddMinutes(-10) },
        });

        var result = (await _service.GetLatestPricesAsync()).ToList();

        Assert.Equal(2, result.Count);
        Assert.Contains(result, r => r.Symbol == "SOJA" && r.Trend == "Alta");
        Assert.Contains(result, r => r.Symbol == "MILHO" && r.Trend == "Baixa");
    }

    [Fact]
    public async Task GetLatestPricesAsync_Retorna_Vazio_Quando_Sem_Dados()
    {
        _repoMock.Setup(r => r.GetAllAsync(It.IsAny<int>())).ReturnsAsync(new List<Commodity>());

        var result = await _service.GetLatestPricesAsync();

        Assert.Empty(result);
    }
}
