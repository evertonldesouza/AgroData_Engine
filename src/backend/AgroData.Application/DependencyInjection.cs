using AgroData.Application.Interfaces;
using AgroData.Application.Services;
using Microsoft.Extensions.DependencyInjection;

namespace AgroData.Application;

/// <summary>Composition root for the application layer.</summary>
public static class DependencyInjection
{
    /// <summary>Registers use cases.</summary>
    /// <param name="services">Service collection.</param>
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<ICommodityService, CommodityService>();
        return services;
    }
}
