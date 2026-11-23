using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using AgroData.Application.DTOs;
using AgroData.Tests.TestSupport;

namespace AgroData.Tests.Api;

public sealed class CommoditiesEndpointTests : IClassFixture<ApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    private readonly HttpClient _client;

    public CommoditiesEndpointTests(ApiFactory factory)
    {
        factory.Seed();
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Get_commodities_returns_one_snapshot_per_symbol()
    {
        using var response = await _client.GetAsync("/api/commodities");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<List<CommoditySnapshotResponse>>(Json);

        Assert.NotNull(payload);
        Assert.Equal(2, payload.Count);
        Assert.Equal(new[] { "MILHO", "SOJA" }, payload.Select(snapshot => snapshot.Symbol));

        var soja = payload[1];
        Assert.Equal(140.0, soja.Price);
        Assert.Equal(135.0, soja.PreviousPrice);
        Assert.Equal(5.0, soja.Delta);
        Assert.Equal(new[] { 130.0, 135.0, 140.0 }, soja.History);
    }

    [Fact]
    public async Task Trends_are_serialised_as_camel_case_strings()
    {
        var json = await _client.GetStringAsync("/api/commodities");
        using var document = JsonDocument.Parse(json);

        var trends = document.RootElement
            .EnumerateArray()
            .Select(element => element.GetProperty("trend").GetString())
            .ToArray();

        Assert.Equal(new[] { "down", "up" }, trends);
    }

    [Fact]
    public async Task Unknown_id_returns_a_problem_details_404()
    {
        using var response = await _client.GetAsync("/api/commodities/999999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Contains("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        using var problem = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(404, problem.RootElement.GetProperty("status").GetInt32());
    }

    [Fact]
    public async Task History_without_a_symbol_returns_400()
    {
        using var response = await _client.GetAsync("/api/commodities/history");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task History_returns_the_series_of_a_symbol()
    {
        using var response = await _client.GetAsync("/api/commodities/history?symbol=soja&points=10");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var history = await response.Content.ReadFromJsonAsync<CommodityHistoryResponse>(Json);

        Assert.NotNull(history);
        Assert.Equal("SOJA", history.Symbol);
        Assert.Equal(3, history.Points.Count);
        Assert.Equal(135.0, history.MovingAverage);
        Assert.Equal(new[] { 130.0, 135.0, 140.0 }, history.Points.Select(point => point.Price));
    }

    [Fact]
    public async Task History_of_an_unknown_symbol_returns_404()
    {
        using var response = await _client.GetAsync("/api/commodities/history?symbol=CAFE");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Responses_are_gzip_compressed_when_requested()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/commodities");
        request.Headers.AcceptEncoding.ParseAdd("gzip");

        using var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("gzip", response.Content.Headers.ContentEncoding);
    }
}
