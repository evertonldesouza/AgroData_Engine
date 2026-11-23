using AgroData.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AgroData.Infrastructure.Context;

/// <summary>EF Core context for the AgroData warehouse.</summary>
public class AppDbContext : DbContext
{
    /// <summary>Initialises a new context.</summary>
    /// <param name="options">Configured options.</param>
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    /// <summary>Commodity price quotes.</summary>
    public DbSet<Commodity> Commodities => Set<Commodity>();

    /// <inheritdoc />
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Applies every IEntityTypeConfiguration in this assembly.
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
