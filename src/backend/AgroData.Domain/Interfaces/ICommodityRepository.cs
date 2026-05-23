using AgroData.Domain.Entities;

namespace AgroData.Domain.Interfaces;

public interface ICommodityRepository
{
    Task<IEnumerable<Commodity>> GetAllAsync(int limit);
    Task<Commodity?> GetByIdAsync(int id);
}