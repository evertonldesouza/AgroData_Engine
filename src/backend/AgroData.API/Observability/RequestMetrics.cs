using System.Collections.Concurrent;
using System.Diagnostics;
using System.Globalization;
using System.Text;

namespace AgroData.API.Observability;

/// <summary>
/// In-process HTTP metrics rendered in the Prometheus text exposition format.
/// </summary>
/// <remarks>
/// <para>
/// Deliberately dependency-free: an OpenTelemetry exporter would be the right
/// call once there is a collector to send to. Until then this endpoint answers
/// the operational questions that actually come up (p95 latency, 5xx rate, which
/// route is hot) without adding a package, a sidecar or a config file.
/// </para>
/// <para>
/// Cardinality is bounded on purpose: labels are the route <em>template</em>
/// (<c>/api/commodities/{id}</c>), never the raw path, so ids do not create new
/// series.
/// </para>
/// </remarks>
public sealed class RequestMetrics
{
    /// <summary>Latency buckets in seconds (Prometheus convention).</summary>
    private static readonly double[] Buckets =
        [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

    private readonly ConcurrentDictionary<Key, Entry> _entries = new();
    private long _inFlight;

    /// <summary>Number of requests currently being processed.</summary>
    public long InFlight => Interlocked.Read(ref _inFlight);

    /// <summary>Increments the in-flight gauge.</summary>
    public void RequestStarted() => Interlocked.Increment(ref _inFlight);

    /// <summary>Decrements the in-flight gauge and records the observation.</summary>
    /// <param name="method">HTTP method.</param>
    /// <param name="route">Route template, or <c>unmatched</c>.</param>
    /// <param name="statusCode">Response status code.</param>
    /// <param name="duration">Observed duration.</param>
    public void RequestFinished(string method, string route, int statusCode, TimeSpan duration)
    {
        Interlocked.Decrement(ref _inFlight);

        var entry = _entries.GetOrAdd(
            new Key(method, route, statusCode),
            _ => new Entry(Buckets.Length));

        Interlocked.Increment(ref entry.Count);
        Interlocked.Add(ref entry.TotalTicks, duration.Ticks);

        var seconds = duration.TotalSeconds;
        for (var index = 0; index < Buckets.Length; index++)
        {
            if (seconds <= Buckets[index])
            {
                Interlocked.Increment(ref entry.Buckets[index]);
            }
        }
    }

    /// <summary>Resets every counter (used by tests).</summary>
    public void Reset()
    {
        _entries.Clear();
        Interlocked.Exchange(ref _inFlight, 0);
    }

    /// <summary>Renders the metrics in the Prometheus text format.</summary>
    public string Render()
    {
        var builder = new StringBuilder();

        builder.AppendLine("# HELP agrodata_http_requests_in_flight Requests currently being processed.");
        builder.AppendLine("# TYPE agrodata_http_requests_in_flight gauge");
        builder.AppendLine(
            $"agrodata_http_requests_in_flight {InFlight.ToString(CultureInfo.InvariantCulture)}");

        builder.AppendLine("# HELP agrodata_http_requests_total Requests served, by route and status.");
        builder.AppendLine("# TYPE agrodata_http_requests_total counter");
        foreach (var (key, entry) in _entries.OrderBy(pair => pair.Key.ToString(), StringComparer.Ordinal))
        {
            builder.AppendLine(
                $"agrodata_http_requests_total{key.Labels} {Volatile.Read(ref entry.Count).ToString(CultureInfo.InvariantCulture)}");
        }

        builder.AppendLine("# HELP agrodata_http_request_duration_seconds Request latency.");
        builder.AppendLine("# TYPE agrodata_http_request_duration_seconds histogram");
        foreach (var (key, entry) in _entries.OrderBy(pair => pair.Key.ToString(), StringComparer.Ordinal))
        {
            for (var index = 0; index < Buckets.Length; index++)
            {
                var labels = key.LabelsWith("le", Buckets[index].ToString(CultureInfo.InvariantCulture));
                var value = Volatile.Read(ref entry.Buckets[index]);
                builder.AppendLine(
                    $"agrodata_http_request_duration_seconds_bucket{labels} {value.ToString(CultureInfo.InvariantCulture)}");
            }

            var count = Volatile.Read(ref entry.Count);
            var labelsInf = key.LabelsWith("le", "+Inf");
            builder.AppendLine(
                $"agrodata_http_request_duration_seconds_bucket{labelsInf} {count.ToString(CultureInfo.InvariantCulture)}");
            builder.AppendLine(
                $"agrodata_http_request_duration_seconds_sum{key.Labels} {(Volatile.Read(ref entry.TotalTicks) / (double)TimeSpan.TicksPerSecond).ToString("0.######", CultureInfo.InvariantCulture)}");
            builder.AppendLine(
                $"agrodata_http_request_duration_seconds_count{key.Labels} {count.ToString(CultureInfo.InvariantCulture)}");
        }

        return builder.ToString();
    }

    private readonly record struct Key(string Method, string Route, int Status)
    {
        public string Labels => FormattableString.Invariant(
            $"{{method=\"{Escape(Method)}\",route=\"{Escape(Route)}\",status=\"{Status}\"}}");

        public string LabelsWith(string name, string value) => FormattableString.Invariant(
            $"{{method=\"{Escape(Method)}\",route=\"{Escape(Route)}\",status=\"{Status}\",{name}=\"{Escape(value)}\"}}");

        public override string ToString() => $"{Method}|{Route}|{Status}";

        private static string Escape(string value) => value.Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("\"", "\\\"", StringComparison.Ordinal);
    }

    private sealed class Entry
    {
        public Entry(int bucketCount) => Buckets = new long[bucketCount];

        public long Count;
        public long TotalTicks;
        public long[] Buckets { get; }
    }
}

/// <summary>Middleware that feeds <see cref="RequestMetrics"/>.</summary>
public static class RequestMetricsMiddleware
{
    /// <summary>Adds the metrics collection middleware.</summary>
    /// <param name="app">Application builder.</param>
    public static IApplicationBuilder UseRequestMetrics(this IApplicationBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        return app.Use(async (context, next) =>
        {
            var metrics = context.RequestServices.GetRequiredService<RequestMetrics>();
            metrics.RequestStarted();
            var started = Stopwatch.GetTimestamp();

            // A timing header helps whoever is debugging the dashboard without
            // opening the metrics endpoint. It has to be written from OnStarting:
            // once the response body is flushed the header collection is immutable.
            context.Response.OnStarting(() =>
            {
                var elapsed = Stopwatch.GetElapsedTime(started);
                context.Response.Headers["X-Response-Time-Ms"] = elapsed.TotalMilliseconds
                    .ToString("0.0", CultureInfo.InvariantCulture);
                return Task.CompletedTask;
            });

            try
            {
                await next(context).ConfigureAwait(false);
            }
            finally
            {
                metrics.RequestFinished(
                    context.Request.Method,
                    RouteOf(context),
                    context.Response.StatusCode,
                    Stopwatch.GetElapsedTime(started));
            }
        });
    }

    private static string RouteOf(HttpContext context) =>
        context.GetEndpoint() is RouteEndpoint endpoint
            ? endpoint.RoutePattern.RawText ?? "unknown"
            : "unmatched";
}
