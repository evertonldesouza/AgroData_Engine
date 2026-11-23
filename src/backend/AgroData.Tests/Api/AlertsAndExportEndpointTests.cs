using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AgroData.Application.Alerts;
using AgroData.Tests.TestSupport;

namespace AgroData.Tests.Api;

public sealed class AlertsAndExportEndpointTests : IClassFixture<ApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    private readonly HttpClient _client;

    public AlertsAndExportEndpointTests(ApiFactory factory)
    {
        factory.Seed();
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Alerts_reports_the_movements_above_the_threshold()
    {
        using var response = await _client.GetAsync("/api/alerts");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var alerts = await response.Content.ReadFromJsonAsync<List<PriceAlert>>(Json);

        Assert.NotNull(alerts);
        Assert.NotEmpty(alerts);

        // The seed moves SOJA +3.7% (critical) and MILHO -1.7% (warning).
        Assert.Equal("SOJA", alerts[0].Symbol);
        Assert.Equal(AlertSeverity.Critical, alerts[0].Severity);
        Assert.All(alerts, alert => Assert.True(Math.Abs(alert.ChangePercent) >= 1.5));
    }

    [Fact]
    public async Task Alerts_are_cacheable_for_a_short_window()
    {
        using var response = await _client.GetAsync("/api/alerts");

        Assert.Contains("max-age=15", response.Headers.CacheControl!.ToString());
    }

    [Fact]
    public async Task Export_returns_a_csv_attachment()
    {
        using var response = await _client.GetAsync("/api/commodities/export?symbol=SOJA&points=10");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.StartsWith("text/csv", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal(
            "attachment",
            response.Content.Headers.ContentDisposition?.DispositionType);
        Assert.EndsWith(
            ".csv",
            response.Content.Headers.ContentDisposition?.FileName?.Trim('"') ?? string.Empty,
            StringComparison.OrdinalIgnoreCase);

        var body = await response.Content.ReadAsStringAsync();
        var lines = body.Split('\n', StringSplitOptions.RemoveEmptyEntries);

        Assert.Equal("timestamp,symbol,price", lines[0]);
        Assert.Equal(4, lines.Length); // header + the three seeded quotes
        Assert.StartsWith("20", lines[1]);
        Assert.Contains(",SOJA,", lines[1]);
    }

    [Fact]
    public async Task Export_requires_a_symbol()
    {
        using var response = await _client.GetAsync("/api/commodities/export");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Export_of_an_unknown_symbol_returns_404()
    {
        using var response = await _client.GetAsync("/api/commodities/export?symbol=CAFE");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
