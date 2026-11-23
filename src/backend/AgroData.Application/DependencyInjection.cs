using AgroData.Application.Alerts;
using AgroData.Application.Caching;
using AgroData.Application.DTOs;
using AgroData.Application.Interfaces;
using AgroData.Application.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;

namespace AgroData.Application;

/// <summary>Composition root for the application layer.</summary>
public static class DependencyInjection
{
    /// <summary>Registers use cases and the read-through cache.</summary>
    /// <param name="services">Service collection.</param>
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.TryAddSingleton(TimeProvider.System);

        services.AddScoped<CommodityService>();

        // The caches must outlive the request, hence the singleton holder.
        services.AddSingleton(provider =>
        {
            var options = provider.GetRequiredService<IOptions<CachingOptions>>().Value;
            var time = provider.GetRequiredService<TimeProvider>();

            return new CommodityCaches(
                new TtlCache<string, IReadOnlyList<CommoditySnapshotResponse>>(
                    time,
                    TimeSpan.FromSeconds(Math.Max(1, options.SnapshotSeconds))),
                new TtlCache<string, CommodityHistoryResponse?>(
                    time,
                    TimeSpan.FromSeconds(Math.Max(1, options.HistorySeconds))));
        });

        // Decorator: the business rules stay unaware of caching, and the cache can
        // be switched off through configuration without touching the call path.
        services.AddScoped<ICommodityService>(provider =>
        {
            var inner = provider.GetRequiredService<CommodityService>();
            var options = provider.GetRequiredService<IOptions<CachingOptions>>().Value;

            return options.Enabled
                ? new CachedCommodityService(inner, provider.GetRequiredService<CommodityCaches>())
                : inner;
        });

        services.AddScoped<IAlertService, AlertService>();

        return services;
    }
}
