using AgroData.Domain.Entities;
using AgroData.Infrastructure.Context;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace AgroData.Tests.TestSupport;

/// <summary>
/// Boots the real HTTP pipeline (middleware, routing, JSON options) on top of an
/// in-memory SQLite database.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    /// <summary>Connection string accepted by Npgsql configuration, replaced by SQLite.</summary>
    private const string PlaceholderConnectionString =
        "Host=localhost;Port=5432;Database=agrodata_tests;Username=test;Password=test";

    private readonly SqliteConnection _connection = new("DataSource=:memory:");
    private bool _seeded;

    public ApiFactory()
    {
        // Environment variables are read while Program builds its configuration,
        // which happens before WebApplicationFactory can inject in-memory values.
        Environment.SetEnvironmentVariable(
            "ConnectionStrings__DefaultConnection",
            PlaceholderConnectionString);
    }

    /// <summary>Idempotently loads a small, deterministic dataset.</summary>
    public void Seed()
    {
        if (_seeded)
        {
            return;
        }

        using var scope = Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        context.Database.EnsureCreated();

        var start = new DateTime(2026, 10, 1, 8, 0, 0, DateTimeKind.Utc);
        context.Commodities.AddRange(
            Quote("SOJA", 130.0, start),
            Quote("SOJA", 135.0, start.AddHours(1)),
            Quote("SOJA", 140.0, start.AddHours(2)),
            Quote("MILHO", 60.0, start),
            Quote("MILHO", 58.0, start.AddHours(1)),
            Quote("MILHO", 57.0, start.AddHours(2)));

        context.SaveChanges();
        _seeded = true;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, configuration) =>
            configuration.AddInMemoryCollection(
                new Dictionary<string, string?>
                {
                    ["ConnectionStrings:DefaultConnection"] = PlaceholderConnectionString,
                }));

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.RemoveAll<AppDbContext>();

            // EF Core 9+ also registers one provider configuration object per context.
            // Matching it by name keeps this host independent of the EF Core version.
            var providerConfigurations = services
                .Where(descriptor => descriptor.ServiceType.Name == "IDbContextOptionsConfiguration`1")
                .ToList();

            foreach (var descriptor in providerConfigurations)
            {
                services.Remove(descriptor);
            }

            _connection.Open();
            services.AddDbContext<AppDbContext>(options => options.UseSqlite(_connection));
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
        {
            _connection.Dispose();
        }
    }

    private static Commodity Quote(string symbol, double price, DateTime timestamp) => new()
    {
        Symbol = symbol,
        Price = price,
        Timestamp = timestamp,
        Source = "IntegrationTest",
    };
}
