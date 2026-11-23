using System.Collections.Concurrent;

namespace AgroData.Application.Caching;

/// <summary>
/// Small thread-safe cache with an absolute TTL and single-flight loading.
/// </summary>
/// <remarks>
/// <para>
/// The point of this type is not to replace a distributed cache; it is to stop
/// the API from hitting PostgreSQL once per polling client. Quotes change once
/// per hour, the dashboard polls every 15 seconds, so a few dozen identical
/// queries per minute were pure waste.
/// </para>
/// <para>
/// Single-flight matters under load: when the entry expires and ten requests
/// arrive at the same time, only the first one calls the database, the other
/// nine wait for that result instead of stampeding it.
/// </para>
/// </remarks>
/// <typeparam name="TKey">Key type.</typeparam>
/// <typeparam name="TValue">Cached value type.</typeparam>
public sealed class TtlCache<TKey, TValue>
    where TKey : notnull
{
    private readonly ConcurrentDictionary<TKey, Entry> _entries = new();
    private readonly ConcurrentDictionary<TKey, SemaphoreSlim> _gates = new();
    private readonly TimeProvider _time;
    private readonly TimeSpan _ttl;

    /// <summary>Initialises a new cache.</summary>
    /// <param name="time">Clock, injectable for tests.</param>
    /// <param name="timeToLive">How long an entry stays fresh.</param>
    public TtlCache(TimeProvider time, TimeSpan timeToLive)
    {
        ArgumentNullException.ThrowIfNull(time);
        if (timeToLive <= TimeSpan.Zero)
        {
            throw new ArgumentOutOfRangeException(
                nameof(timeToLive), timeToLive, "The time to live must be positive.");
        }

        _time = time;
        _ttl = timeToLive;
    }

    /// <summary>Number of entries currently stored (expired ones excluded).</summary>
    public int Count
    {
        get
        {
            var now = _time.GetUtcNow();
            return _entries.Values.Count(entry => entry.ExpiresAt > now);
        }
    }

    /// <summary>How long an entry stays fresh.</summary>
    public TimeSpan TimeToLive => _ttl;

    /// <summary>
    /// Returns the cached value, or loads it once via
    /// <paramref name="factory"/>. Expired entries are replaced.
    /// </summary>
    /// <param name="key">Cache key.</param>
    /// <param name="factory">Loader executed at most once per expiration window.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    public async Task<TValue> GetOrCreateAsync(
        TKey key,
        Func<CancellationToken, Task<TValue>> factory,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(factory);

        if (TryGet(key, out var cached))
        {
            return cached;
        }

        var gate = _gates.GetOrAdd(key, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken).ConfigureAwait(false);

        try
        {
            // Another caller may have filled the cache while we waited.
            if (TryGet(key, out cached))
            {
                return cached;
            }

            var value = await factory(cancellationToken).ConfigureAwait(false);
            Set(key, value);
            return value;
        }
        finally
        {
            gate.Release();
        }
    }

    /// <summary>Attempts to read a non-expired value.</summary>
    /// <param name="key">Cache key.</param>
    /// <param name="value">Cached value when found.</param>
    public bool TryGet(TKey key, out TValue value)
    {
        if (_entries.TryGetValue(key, out var entry))
        {
            if (entry.ExpiresAt > _time.GetUtcNow())
            {
                value = entry.Value;
                return true;
            }

            _entries.TryRemove(key, out _);
        }

        value = default!;
        return false;
    }

    /// <summary>Stores a value, replacing any previous entry.</summary>
    /// <param name="key">Cache key.</param>
    /// <param name="value">Value to store.</param>
    public void Set(TKey key, TValue value) =>
        _entries[key] = new Entry(value, _time.GetUtcNow().Add(_ttl));

    /// <summary>Removes a single entry.</summary>
    /// <param name="key">Cache key.</param>
    public void Invalidate(TKey key) => _entries.TryRemove(key, out _);

    /// <summary>Removes every entry.</summary>
    public void Clear() => _entries.Clear();

    private sealed record Entry(TValue Value, DateTimeOffset ExpiresAt);
}
