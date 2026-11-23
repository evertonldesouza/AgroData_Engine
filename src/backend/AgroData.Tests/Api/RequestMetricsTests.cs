using System.Net;
using AgroData.API.Observability;
using AgroData.Tests.TestSupport;

namespace AgroData.Tests.Api;

public sealed class RequestMetricsTests
{
    [Fact]
    public void Renders_prometheus_text_format()
    {
        var metrics = new RequestMetrics();

        metrics.RequestStarted();
        metrics.RequestFinished("GET", "api/commodities", 200, TimeSpan.FromMilliseconds(40));

        var output = metrics.Render();

        Assert.Contains("# TYPE agrodata_http_requests_total counter", output);
        Assert.Contains(
            "agrodata_http_requests_total{method=\"GET\",route=\"api/commodities\",status=\"200\"} 1",
            output);
        Assert.Contains(
            "agrodata_http_request_duration_seconds_count{method=\"GET\",route=\"api/commodities\",status=\"200\"} 1",
            output);
        Assert.Contains("le=\"+Inf\"", output);
    }

    [Fact]
    public void Buckets_are_cumulative()
    {
        var metrics = new RequestMetrics();

        metrics.RequestStarted();
        metrics.RequestFinished("GET", "api/commodities", 200, TimeSpan.FromMilliseconds(30));
        metrics.RequestStarted();
        metrics.RequestFinished("GET", "api/commodities", 200, TimeSpan.FromMilliseconds(300));

        var output = metrics.Render();

        // 30 ms falls inside the 50 ms bucket, 300 ms does not.
        Assert.Contains("agrodata_http_request_duration_seconds_bucket{method=\"GET\",route=\"api/commodities\",status=\"200\",le=\"0.05\"} 1", output);
        Assert.Contains("agrodata_http_request_duration_seconds_bucket{method=\"GET\",route=\"api/commodities\",status=\"200\",le=\"0.5\"} 2", output);
    }

    [Fact]
    public void Aggregates_by_status_code()
    {
        var metrics = new RequestMetrics();

        metrics.RequestFinished("GET", "api/commodities", 200, TimeSpan.FromMilliseconds(5));
        metrics.RequestFinished("GET", "api/commodities", 500, TimeSpan.FromMilliseconds(5));

        var output = metrics.Render();

        Assert.Contains("status=\"200\"} 1", output);
        Assert.Contains("status=\"500\"} 1", output);
    }

    [Fact]
    public void In_flight_gauge_goes_up_and_down()
    {
        var metrics = new RequestMetrics();
        Assert.Equal(0, metrics.InFlight);

        metrics.RequestStarted();
        metrics.RequestStarted();
        Assert.Equal(2, metrics.InFlight);

        metrics.RequestFinished("GET", "api/commodities", 200, TimeSpan.FromMilliseconds(1));
        Assert.Equal(1, metrics.InFlight);

        metrics.Reset();
        Assert.Equal(0, metrics.InFlight);
        Assert.DoesNotContain("route=\"api", metrics.Render());
    }

    [Fact]
    public void Label_values_are_escaped()
    {
        var metrics = new RequestMetrics();
        metrics.RequestFinished("GET", "weird\"route", 200, TimeSpan.FromMilliseconds(1));

        Assert.Contains("route=\"weird\\\"route\"", metrics.Render());
    }

    [Fact]
    public void Durations_use_the_invariant_culture()
    {
        var metrics = new RequestMetrics();
        metrics.RequestFinished("GET", "api/commodities", 200, TimeSpan.FromMilliseconds(1500));

        var line = metrics.Render()
            .Split('\n')
            .Single(item => item.StartsWith("agrodata_http_request_duration_seconds_sum", StringComparison.Ordinal));

        Assert.Contains("1.5", line);
        Assert.DoesNotContain("1,5", line);
    }
}

public sealed class MetricsEndpointTests : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client;

    public MetricsEndpointTests(ApiFactory factory)
    {
        factory.Seed();
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Metrics_endpoint_reports_traffic_in_prometheus_format()
    {
        using var request = await _client.GetAsync("/api/commodities");
        await request.Content.ReadAsStringAsync();

        using var response = await _client.GetAsync("/metrics");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.StartsWith("text/plain", response.Content.Headers.ContentType?.MediaType);

        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("agrodata_http_requests_total", body);
        Assert.Contains("route=\"api/commodities\"", body);
        Assert.Contains("status=\"200\"", body);
    }

    [Fact]
    public async Task Every_response_carries_a_server_side_timing_header()
    {
        using var response = await _client.GetAsync("/api/commodities");

        Assert.True(response.Headers.Contains("X-Response-Time-Ms"));
        var value = response.Headers.GetValues("X-Response-Time-Ms").Single();
        Assert.True(double.TryParse(value, System.Globalization.CultureInfo.InvariantCulture, out _));
    }

    [Fact]
    public async Task Unmatched_routes_are_labelled_as_such()
    {
        using var response = await _client.GetAsync("/api/does-not-exist");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);

        var body = await _client.GetStringAsync("/metrics");

        Assert.Contains("route=\"unmatched\"", body);
    }
}
