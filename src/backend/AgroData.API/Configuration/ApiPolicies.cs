namespace AgroData.API.Configuration;

/// <summary>Names of the CORS and rate limiting policies.</summary>
public static class ApiPolicies
{
    /// <summary>CORS policy used by the dashboard.</summary>
    public const string FrontendCors = "frontend";

    /// <summary>Fixed window rate limit applied to the public API.</summary>
    public const string PublicApi = "public-api";
}
