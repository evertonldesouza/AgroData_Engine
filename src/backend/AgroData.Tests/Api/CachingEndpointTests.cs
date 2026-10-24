using System.Net;
using AgroData.Tests.TestSupport;

namespace AgroData.Tests.Api;

/// <summary>
/// The dashboard polls every 15 seconds; without caching every client costs one
/// database round trip per poll. These tests pin the HTTP contract that makes
/// caching (and conditional requests) work.
/// </summary>
public sealed class CachingEndpointTests : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client;

    public CachingEndpointTests(ApiFactory factory)
    {
        factory.Seed();
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Snapshots_expose_validators_and_cache_directives()
    {
        using var response = await _client.GetAsync("/api/commodities");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(response.Headers.ETag);
        Assert.True(response.Headers.ETag!.IsWeak == false);
        Assert.Contains("public", response.Headers.CacheControl!.ToString());
        Assert.Contains("max-age=20", response.Headers.CacheControl!.ToString());
        Assert.NotNull(response.Content.Headers.LastModified);
    }

    [Fact]
    public async Task Repeating_a_request_with_the_etag_returns_304_without_a_body()
    {
        using var first = await _client.GetAsync("/api/commodities");
        var entityTag = first.Headers.ETag!;

        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/commodities");
        request.Headers.IfNoneMatch.Add(entityTag);
        using var second = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotModified, second.StatusCode);
        Assert.Empty(await second.Content.ReadAsByteArrayAsync());
        Assert.Equal(entityTag, second.Headers.ETag);
    }

    [Fact]
    public async Task A_stale_etag_still_receives_the_payload()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/commodities");
        request.Headers.IfNoneMatch.ParseAdd("\"stale-tag\"");
        using var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotEmpty(await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task History_supports_conditional_requests_too()
    {
        const string url = "/api/commodities/history?symbol=SOJA&points=10";

        using var first = await _client.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.IfNoneMatch.Add(first.Headers.ETag!);
        using var second = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotModified, second.StatusCode);
    }

    [Fact]
    public async Task A_404_has_no_cache_validators()
    {
        using var response = await _client.GetAsync("/api/commodities/history?symbol=CAFE");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Null(response.Headers.ETag);
    }
}
