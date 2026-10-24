using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using AgroData.API.Configuration;
using AgroData.API.Endpoints;
using AgroData.API.Errors;
using AgroData.Application.Alerts;
using AgroData.Application.Caching;
using AgroData.Infrastructure.HealthChecks;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.ResponseCompression;

namespace AgroData.API.Extensions;

/// <summary>Wires the HTTP concerns of the API.</summary>
public static class ServiceCollectionExtensions
{
    private static readonly string[] ProblemDetailsMimeTypes =
        ["application/json", "application/problem+json"];

    /// <summary>
    /// Registers controllers, JSON options, CORS, rate limiting, health checks,
    /// problem details, compression and Swagger.
    /// </summary>
    /// <param name="services">Service collection.</param>
    /// <param name="configuration">Application configuration.</param>
    public static IServiceCollection AddApiServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services
            .AddControllers()
            .AddJsonOptions(options =>
            {
                options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
                options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
                options.JsonSerializerOptions.Converters.Add(
                    new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
            });

        services.AddProblemDetails();
        services.AddExceptionHandler<GlobalExceptionHandler>();
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(options =>
        {
            var xmlDocumentation = Path.Combine(
                AppContext.BaseDirectory,
                $"{Assembly.GetExecutingAssembly().GetName().Name}.xml");

            if (File.Exists(xmlDocumentation))
            {
                options.IncludeXmlComments(xmlDocumentation, includeControllerXmlComments: true);
            }
        });

        services
            .AddOptions<AlertOptions>()
            .Bind(configuration.GetSection(AlertOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services
            .AddOptions<CachingOptions>()
            .Bind(configuration.GetSection(CachingOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services
            .AddOptions<CorsOptions>()
            .Bind(configuration.GetSection(CorsOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddCors(options =>
            options.AddPolicy(
                ApiPolicies.FrontendCors,
                policy => policy
                    .WithOrigins(ResolveAllowedOrigins(configuration))
                    .AllowAnyHeader()
                    .AllowAnyMethod()));

        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy(
                ApiPolicies.PublicApi,
                context => RateLimitPartition.GetFixedWindowLimiter(
                    partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    factory: _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 120,
                        Window = TimeSpan.FromMinutes(1),
                        QueueLimit = 0,
                    }));
        });

        services
            .AddHealthChecks()
            .AddCheck<DatabaseHealthCheck>("postgresql", tags: [HealthEndpoints.ReadyTag]);

        services.AddResponseCompression(options =>
        {
            options.EnableForHttps = true;
            options.Providers.Add<BrotliCompressionProvider>();
            options.Providers.Add<GzipCompressionProvider>();
            options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(ProblemDetailsMimeTypes);
        });

        return services;
    }

    /// <summary>
    /// Combines the configured origins with the legacy <c>FRONTEND_URL</c>
    /// environment variable, so existing deployments keep working.
    /// </summary>
    private static string[] ResolveAllowedOrigins(IConfiguration configuration)
    {
        var options = configuration.GetSection(CorsOptions.SectionName).Get<CorsOptions>();
        var origins = new List<string>(options?.AllowedOrigins ?? Array.Empty<string>());

        foreach (var candidate in new[]
                 {
                     Environment.GetEnvironmentVariable("FRONTEND_URL"),
                     configuration["FRONTEND_URL"],
                 })
        {
            if (!string.IsNullOrWhiteSpace(candidate))
            {
                origins.Add(candidate.TrimEnd('/'));
            }
        }

        return origins
            .Where(origin => !string.IsNullOrWhiteSpace(origin))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }
}
