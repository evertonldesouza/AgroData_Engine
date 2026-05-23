using AgroData.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AgroData.Infrastructure.Context;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Commodity> Commodities { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        modelBuilder.Entity<Commodity>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Symbol).IsRequired();
            entity.Property(e => e.Price).IsRequired();
            entity.HasIndex(e => e.Symbol);
        });
    }
}