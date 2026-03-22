namespace Hyoka.Application.Models;

public static class WidgetKeys
{
    public const string WeatherLocal = "weather.local";
    public const string NewsLocal = "news.local";

    public static readonly IReadOnlyList<string> All = [WeatherLocal, NewsLocal];

    public static bool IsKnown(string key)
    {
        return All.Contains(key, StringComparer.OrdinalIgnoreCase);
    }
}

public sealed class WidgetLocationPreference
{
    public string Source { get; init; } = "manual";
    public string Label { get; init; } = string.Empty;
    public double Latitude { get; init; }
    public double Longitude { get; init; }
    public string Locality { get; init; } = string.Empty;
    public string PrincipalSubdivision { get; init; } = string.Empty;
    public string CountryCode { get; init; } = "GB";
    public string? Postcode { get; init; }
    public string Timezone { get; init; } = "UTC";
}

public sealed class HubPreferences
{
    public IReadOnlyList<string> OrderedWidgetKeys { get; init; } = [];
    public WidgetLocationPreference? Location { get; init; }
    public DateTime UpdatedAtUtc { get; init; }

    public static HubPreferences Empty(DateTime? updatedAtUtc = null)
    {
        return new HubPreferences
        {
            UpdatedAtUtc = updatedAtUtc ?? DateTime.UtcNow
        };
    }
}

public sealed class WidgetLocationSearchResult
{
    public string Label { get; init; } = string.Empty;
    public double Latitude { get; init; }
    public double Longitude { get; init; }
    public string Locality { get; init; } = string.Empty;
    public string PrincipalSubdivision { get; init; } = string.Empty;
    public string CountryCode { get; init; } = "GB";
    public string? Postcode { get; init; }
    public string Timezone { get; init; } = "UTC";
}

public sealed class WeatherWidgetData
{
    public string Timezone { get; init; } = "UTC";
    public WeatherCurrentConditions Current { get; init; } = new();
    public IReadOnlyList<WeatherForecastDay> Forecast { get; init; } = [];
    public DateTime FetchedAtUtc { get; init; } = DateTime.UtcNow;
}

public sealed class WeatherCurrentConditions
{
    public string Time { get; init; } = string.Empty;
    public double TemperatureC { get; init; }
    public double ApparentTemperatureC { get; init; }
    public double WindSpeedKph { get; init; }
    public int WeatherCode { get; init; }
    public string Condition { get; init; } = string.Empty;
    public bool IsDay { get; init; }
}

public sealed class WeatherForecastDay
{
    public string Date { get; init; } = string.Empty;
    public double MinTemperatureC { get; init; }
    public double MaxTemperatureC { get; init; }
    public int WeatherCode { get; init; }
    public string Condition { get; init; } = string.Empty;
}

public sealed class NewsWidgetData
{
    public bool IsAvailable { get; init; } = true;
    public string Mode { get; init; } = "local-search";
    public string QueryLabel { get; init; } = string.Empty;
    public string? Message { get; init; }
    public IReadOnlyList<NewsHeadline> Headlines { get; init; } = [];
    public DateTime FetchedAtUtc { get; init; } = DateTime.UtcNow;
}

public sealed class NewsHeadline
{
    public string Title { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public string Url { get; init; } = string.Empty;
    public string Source { get; init; } = string.Empty;
    public string? ImageUrl { get; init; }
    public DateTime PublishedAtUtc { get; init; }
}
