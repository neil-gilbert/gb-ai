namespace Hyoka.Infrastructure.Services;

public static class WidgetCacheKeys
{
    public static string Weather(double latitude, double longitude, string timezone)
    {
        return $"widgets:weather:{Math.Round(latitude, 3):0.000}:{Math.Round(longitude, 3):0.000}:{Normalize(timezone)}";
    }

    public static string News(string locality, string principalSubdivision, string countryCode)
    {
        return $"widgets:news:{Normalize(locality)}:{Normalize(principalSubdivision)}:{Normalize(countryCode)}";
    }

    private static string Normalize(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? "-"
            : value.Trim().ToLowerInvariant();
    }
}
