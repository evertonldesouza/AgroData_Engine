using AgroData.Application.Caching;
using AgroData.Tests.TestSupport;

namespace AgroData.Tests.Application;

public sealed class TtlCacheTests
{
    private readonly ManualTimeProvider _time = new();

    [Fact]
    public async Task Loads_once_and_serves_the_cached_value_afterwards()
    {
        var cache = new TtlCache<string, int>(_time, TimeSpan.FromSeconds(30));
        var calls = 0;

        var first = await cache.GetOrCreateAsync("price", _ => Task.FromResult(++calls));
        var second = await cache.GetOrCreateAsync("price", _ => Task.FromResult(++calls));

        Assert.Equal(1, first);
        Assert.Equal(1, second);
        Assert.Equal(1, calls);
    }

    [Fact]
    public async Task Reloads_after_the_time_to_live_expires()
    {
        var cache = new TtlCache<string, int>(_time, TimeSpan.FromSeconds(30));
        var calls = 0;

        await cache.GetOrCreateAsync("price", _ => Task.FromResult(++calls));
        _time.AdvanceSeconds(29);
        await cache.GetOrCreateAsync("price", _ => Task.FromResult(++calls));
        Assert.Equal(1, calls);

        _time.AdvanceSeconds(2);
        var reloaded = await cache.GetOrCreateAsync("price", _ => Task.FromResult(++calls));

        Assert.Equal(2, calls);
        Assert.Equal(2, reloaded);
    }

    [Fact]
    public async Task Concurrent_misses_trigger_a_single_load()
    {
        var cache = new TtlCache<string, int>(_time, TimeSpan.FromSeconds(30));
        var calls = 0;

        var results = await Task.WhenAll(
            Enumerable.Range(0, 20).Select(_ => cache.GetOrCreateAsync(
                "price",
                async token =>
                {
                    Interlocked.Increment(ref calls);
                    await Task.Delay(30, token);
                    return 42;
                })));

        Assert.Equal(1, calls);
        Assert.All(results, value => Assert.Equal(42, value));
    }

    [Fact]
    public async Task Invalidate_forces_the_next_call_to_reload()
    {
        var cache = new TtlCache<string, int>(_time, TimeSpan.FromSeconds(30));
        var calls = 0;

        await cache.GetOrCreateAsync("price", _ => Task.FromResult(++calls));
        cache.Invalidate("price");

        Assert.False(cache.TryGet("price", out _));
        await cache.GetOrCreateAsync("price", _ => Task.FromResult(++calls));
        Assert.Equal(2, calls);
    }

    [Fact]
    public void Clear_empties_every_key()
    {
        var cache = new TtlCache<string, int>(_time, TimeSpan.FromSeconds(30));
        cache.Set("a", 1);
        cache.Set("b", 2);

        cache.Clear();

        Assert.Equal(0, cache.Count);
        Assert.False(cache.TryGet("a", out _));
    }

    [Fact]
    public void Count_ignores_expired_entries()
    {
        var cache = new TtlCache<string, int>(_time, TimeSpan.FromSeconds(10));
        cache.Set("a", 1);
        cache.Set("b", 2);
        Assert.Equal(2, cache.Count);

        _time.AdvanceSeconds(11);

        Assert.Equal(0, cache.Count);
    }

    [Fact]
    public void Expired_values_are_not_returned()
    {
        var cache = new TtlCache<string, int>(_time, TimeSpan.FromSeconds(5));
        cache.Set("a", 1);
        _time.AdvanceSeconds(6);

        Assert.False(cache.TryGet("a", out var value));
        Assert.Equal(0, value);
    }

    [Fact]
    public async Task Cancellation_is_propagated_to_the_loader()
    {
        var cache = new TtlCache<string, int>(_time, TimeSpan.FromSeconds(30));
        using var source = new CancellationTokenSource();
        await source.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            cache.GetOrCreateAsync(
                "price",
                async token =>
                {
                    await Task.Delay(TimeSpan.FromSeconds(1), token);
                    return 1;
                },
                source.Token));
    }

    [Fact]
    public void Non_positive_time_to_live_is_rejected()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new TtlCache<string, int>(_time, TimeSpan.Zero));
    }

    [Fact]
    public void Exposes_the_configured_time_to_live()
    {
        var cache = new TtlCache<string, int>(_time, TimeSpan.FromSeconds(15));
        Assert.Equal(TimeSpan.FromSeconds(15), cache.TimeToLive);
    }
}
