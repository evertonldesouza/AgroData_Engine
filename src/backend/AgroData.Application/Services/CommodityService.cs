using AgroData.Application.DTOs;
using AgroData.Application.Interfaces;
using AgroData.Domain.Interfaces;

namespace AgroData.Application.Services;

public class CommodityService : ICommodityService
{
    private readonly ICommodityRepository _repository;

    public CommodityService(ICommodityRepository repository)
    {
        _repository = repository;
    }

    public async Task<IEnumerable<CommodityResponse>> GetLatestPricesAsync()
    {
        var data = await _repository.GetAllAsync(20);

        return data
            .GroupBy(c => c.Symbol)
            .Select(g =>
            {
                var ordered = g.OrderByDescending(c => c.Timestamp).ToList();
                var latest = ordered.First();
                var previous = ordered.Skip(1).FirstOrDefault();

                var trend = previous == null ? "Estável"
                    : latest.Price > previous.Price ? "Alta"
                    : latest.Price < previous.Price ? "Baixa"
                    : "Estável";

                return new CommodityResponse
                {
                    Symbol = latest.Symbol,
                    Price = latest.Price,
                    Timestamp = latest.Timestamp,
                    Trend = trend
                };
            });
    }
}
