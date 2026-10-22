using AgroData.Domain.Interfaces;
using AgroData.Infrastructure.Context;
using AgroData.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace AgroData.Infrastructure;

/// <summary>Composition root for the infrastructure layer.</summary>
public static class DependencyInjection
{
    /// <summary>Registers the database context and repositories.</summary>
    /// <param name="services">Service collection.</param>
    /// <param name="configuration">Application configuration.</param>
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "ConnectionStrings:DefaultConnection is not configured. "
                + "Set the ConnectionStrings__DefaultConnection environment variable.");
        }

        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(
                connectionString,
                // Transient connection errors (e.g. a paused Supabase instance) are retried.
                npgsql => npgsql.EnableRetryOnFailure()));

        services.AddScoped<ICommodityRepository, CommodityRepository>();

        return services;
    }
}
