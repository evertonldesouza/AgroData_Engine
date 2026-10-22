using System.ComponentModel.DataAnnotations;

namespace AgroData.API.Configuration;

/// <summary>CORS configuration bound from the <c>Cors</c> section.</summary>
public sealed class CorsOptions
{
    /// <summary>Configuration section name.</summary>
    public const string SectionName = "Cors";

    /// <summary>
    /// Origins allowed to call the API. The GitHub Pages frontend and the local
    /// Vite dev server are allowed by default; production overrides them through
    /// <c>Cors__AllowedOrigins__0</c> or <c>FRONTEND_URL</c>.
    /// </summary>
    [Required]
    [MinLength(1, ErrorMessage = "At least one allowed origin must be configured.")]
    public string[] AllowedOrigins { get; init; } =
    [
        "http://localhost:5173",
        "http://localhost:4173",
        "https://evertonldesouza.github.io",
    ];
}
