using System.Net;
using System.Text.Json;
using AgroData.Tests.TestSupport;

namespace AgroData.Tests.Api;

public sealed class HealthEndpointTests : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client;

    public HealthEndpointTests(ApiFactory factory)
    {
        factory.Seed();
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Health_reports_the_database_status()
    {
        var response = await _client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        Assert.Equal("healthy", document.RootElement.GetProperty("status").GetString());
        var check = document.RootElement.GetProperty("checks").EnumerateArray().Single();
        Assert.Equal("postgresql", check.GetProperty("name").GetString());
        Assert.Equal("healthy", check.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Liveness_probe_does_not_touch_the_database()
    {
        var response = await _client.GetAsync("/health/live");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("Healthy", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Readiness_probe_checks_the_database()
    {
        var response = await _client.GetAsync("/health/ready");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("healthy", document.RootElement.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Swagger_document_is_published()
    {
        var response = await _client.GetAsync("/swagger/v1/swagger.json");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        Assert.Contains("/api/commodities", json);
    }
}
