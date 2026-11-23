using Microsoft.Net.Http.Headers;

namespace AgroData.API.Http;

/// <summary>
/// Conditional GET support: <c>ETag</c>, <c>Last-Modified</c>, <c>Cache-Control</c>
/// and the <c>304 Not Modified</c> short-circuit.
/// </summary>
public static class ConditionalGet
{
    /// <summary>
    /// Publishes the validators and cache directives, then reports whether the
    /// caller already holds this representation.
    /// </summary>
    /// <param name="context">Current HTTP context.</param>
    /// <param name="entityTag">Strong entity tag, quoted (e.g. <c>"a1b2-2"</c>).</param>
    /// <param name="lastModified">When the data last changed, if known.</param>
    /// <param name="maxAge">How long clients may reuse the response.</param>
    public static bool IsNotModified(
        HttpContext context,
        string entityTag,
        DateTimeOffset? lastModified,
        TimeSpan maxAge)
    {
        ArgumentNullException.ThrowIfNull(context);

        var response = context.Response;
        response.Headers.ETag = entityTag;

        if (lastModified is { } modified)
        {
            response.GetTypedHeaders().LastModified = modified;
        }

        var maxAgeSeconds = Math.Max(0, (int)maxAge.TotalSeconds);
        response.Headers.CacheControl = FormattableString.Invariant(
            $"public, max-age={maxAgeSeconds}, stale-while-revalidate={maxAgeSeconds * 2}");

        var ifNoneMatch = context.Request.Headers.IfNoneMatch;
        if (ifNoneMatch.Count == 0)
        {
            return false;
        }

        foreach (var candidate in ifNoneMatch)
        {
            foreach (var raw in (candidate ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries))
            {
                var tag = raw.Trim();

                // Wildcard: "if the resource exists, don't send it".
                if (tag == "*")
                {
                    return true;
                }

                // Weak validators are accepted for GET; comparison is on the tag itself.
                if (tag.StartsWith("W/", StringComparison.Ordinal))
                {
                    tag = tag[2..];
                }

                if (string.Equals(tag, entityTag, StringComparison.Ordinal))
                {
                    return true;
                }
            }
        }

        return false;
    }

    /// <summary>
    /// Marks a response as not cacheable by shared caches, used when the server
    /// side cache is disabled and every request must reach the database.
    /// </summary>
    /// <param name="context">Current HTTP context.</param>
    public static void DisableCaching(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        context.Response.Headers.CacheControl = "public, max-age=0, must-revalidate";
    }
}
