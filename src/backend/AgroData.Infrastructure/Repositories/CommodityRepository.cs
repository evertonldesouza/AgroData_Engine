using AgroData.Domain.Entities;
using AgroData.Domain.Interfaces;
using AgroData.Infrastructure.Context;
using Microsoft.EntityFrameworkCore;

namespace AgroData.Infrastructure.Repositories;

public class CommodityRepository : ICommodityRepository
{
    private readonly AppDbContext _context;

    public CommodityRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<Commodity>> GetAllAsync(int limit)
    {
        return await _context.Commodities
            .OrderByDescending(x => x.Timestamp)
            .Take(limit)
            .ToListAsync();
    }

    public async Task<Commodity?> GetByIdAsync(int id)
    {
        return await _context.Commodities.FindAsync(id);
    }
}