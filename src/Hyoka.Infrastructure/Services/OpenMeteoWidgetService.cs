using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Hyoka.Application.Abstractions;
using Hyoka.Application.Models;
using Microsoft.Extensions.Caching.Memory;

namespace Hyoka.Infrastructure.Services;

public sealed class OpenMeteoWidgetService(
    IHttpClientFactory httpClientFactory,
    IMemoryCache cache) : IWeatherWidgetService
{
    private static readonly TimeSpan WeatherCacheDuration = TimeSpan.FromMinutes(10);

    public async Task<IReadOnlyList<WidgetLocationSearchResult>> SearchLocationsAsync(string query, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(query) || query.Trim().Length < 2)
        {
            return [];
        }

        using var http = httpClientFactory.CreateClient();
        var url = $"https://geocoding-api.open-meteo.com/v1/search?name={Uri.EscapeDataString(query.Trim())}&count=8&language=en&format=json";
        var response = await http.GetFromJsonAsync<OpenMeteoGeocodingResponse>(url, ct);

        return (response?.Results ?? [])
            .Where(x => !string.IsNullOrWhiteSpace(x.Name))
            .Select(MapLocationSearchResult)
            .ToList();
    }

    public async Task<WeatherWidgetData> GetForecastAsync(double latitude, double longitude, string timezone, bool refresh, CancellationToken ct)
    {
        var normalizedTimezone = string.IsNullOrWhiteSpace(timezone) ? "auto" : timezone.Trim();
        var cacheKey = WidgetCacheKeys.Weather(latitude, longitude, normalizedTimezone);

        if (!refresh && cache.TryGetValue<WeatherWidgetData>(cacheKey, out var cached) && cached is not null)
        {
            return cached;
        }

        using var http = httpClientFactory.CreateClient();
        var url =
            "https://api.open-meteo.com/v1/forecast"
            + $"?latitude={latitude:0.####}"
            + $"&longitude={longitude:0.####}"
            + $"&timezone={Uri.EscapeDataString(normalizedTimezone)}"
            + "&current=temperature_2m,apparent_temperature,is_day,weather_code,wind_speed_10m"
            + "&daily=weather_code,temperature_2m_max,temperature_2m_min"
            + "&forecast_days=5";

        var response = await http.GetFromJsonAsync<OpenMeteoForecastResponse>(url, ct)
            ?? throw new InvalidOperationException("Weather data was empty.");

        var data = new WeatherWidgetData
        {
            Timezone = response.Timezone ?? normalizedTimezone,
            Current = new WeatherCurrentConditions
            {
                Time = response.Current?.Time ?? string.Empty,
                TemperatureC = response.Current?.Temperature2m ?? 0,
                ApparentTemperatureC = response.Current?.ApparentTemperature ?? 0,
                WindSpeedKph = response.Current?.WindSpeed10m ?? 0,
                WeatherCode = response.Current?.WeatherCode ?? 0,
                Condition = DescribeWeatherCode(response.Current?.WeatherCode ?? 0),
                IsDay = (response.Current?.IsDay ?? 1) == 1
            },
            Forecast = MapForecast(response.Daily),
            FetchedAtUtc = DateTime.UtcNow
        };

        cache.Set(cacheKey, data, WeatherCacheDuration);
        return data;
    }

    private static IReadOnlyList<WeatherForecastDay> MapForecast(OpenMeteoDailyForecast? daily)
    {
        if (daily?.Time is null
            || daily.Temperature2mMax is null
            || daily.Temperature2mMin is null
            || daily.WeatherCode is null)
        {
            return [];
        }

        var count = new[]
        {
            daily.Time.Count,
            daily.Temperature2mMax.Count,
            daily.Temperature2mMin.Count,
            daily.WeatherCode.Count
        }.Min();

        var result = new List<WeatherForecastDay>(count);
        for (var index = 0; index < count; index += 1)
        {
            var weatherCode = daily.WeatherCode[index];
            result.Add(new WeatherForecastDay
            {
                Date = daily.Time[index],
                MinTemperatureC = daily.Temperature2mMin[index],
                MaxTemperatureC = daily.Temperature2mMax[index],
                WeatherCode = weatherCode,
                Condition = DescribeWeatherCode(weatherCode)
            });
        }

        return result;
    }

    private static WidgetLocationSearchResult MapLocationSearchResult(OpenMeteoGeocodingLocation location)
    {
        var locality = location.Name?.Trim() ?? string.Empty;
        var subdivision = location.Admin1?.Trim() ?? string.Empty;
        var countryCode = location.CountryCode?.Trim().ToUpperInvariant() ?? "GB";
        var label = string.Join(", ", new[] { locality, subdivision, countryCode }.Where(x => !string.IsNullOrWhiteSpace(x)));

        return new WidgetLocationSearchResult
        {
            Label = label,
            Latitude = location.Latitude,
            Longitude = location.Longitude,
            Locality = locality,
            PrincipalSubdivision = subdivision,
            CountryCode = countryCode,
            Postcode = location.Postcodes?.FirstOrDefault(),
            Timezone = location.Timezone?.Trim() ?? "UTC"
        };
    }

    public static string DescribeWeatherCode(int weatherCode)
    {
        return weatherCode switch
        {
            0 => "Clear",
            1 => "Mostly clear",
            2 => "Partly cloudy",
            3 => "Overcast",
            45 or 48 => "Fog",
            51 or 53 or 55 => "Drizzle",
            56 or 57 => "Freezing drizzle",
            61 or 63 or 65 => "Rain",
            66 or 67 => "Freezing rain",
            71 or 73 or 75 or 77 => "Snow",
            80 or 81 or 82 => "Rain showers",
            85 or 86 => "Snow showers",
            95 => "Thunderstorm",
            96 or 99 => "Storm with hail",
            _ => "Unsettled"
        };
    }

    private sealed class OpenMeteoGeocodingResponse
    {
        [JsonPropertyName("results")]
        public List<OpenMeteoGeocodingLocation> Results { get; init; } = [];
    }

    private sealed class OpenMeteoGeocodingLocation
    {
        [JsonPropertyName("name")]
        public string? Name { get; init; }

        [JsonPropertyName("latitude")]
        public double Latitude { get; init; }

        [JsonPropertyName("longitude")]
        public double Longitude { get; init; }

        [JsonPropertyName("country_code")]
        public string? CountryCode { get; init; }

        [JsonPropertyName("admin1")]
        public string? Admin1 { get; init; }

        [JsonPropertyName("timezone")]
        public string? Timezone { get; init; }

        [JsonPropertyName("postcodes")]
        public List<string>? Postcodes { get; init; }
    }

    private sealed class OpenMeteoForecastResponse
    {
        [JsonPropertyName("timezone")]
        public string? Timezone { get; init; }

        [JsonPropertyName("current")]
        public OpenMeteoCurrentWeather? Current { get; init; }

        [JsonPropertyName("daily")]
        public OpenMeteoDailyForecast? Daily { get; init; }
    }

    private sealed class OpenMeteoCurrentWeather
    {
        [JsonPropertyName("time")]
        public string? Time { get; init; }

        [JsonPropertyName("temperature_2m")]
        public double Temperature2m { get; init; }

        [JsonPropertyName("apparent_temperature")]
        public double ApparentTemperature { get; init; }

        [JsonPropertyName("wind_speed_10m")]
        public double WindSpeed10m { get; init; }

        [JsonPropertyName("weather_code")]
        public int WeatherCode { get; init; }

        [JsonPropertyName("is_day")]
        public int IsDay { get; init; }
    }

    private sealed class OpenMeteoDailyForecast
    {
        [JsonPropertyName("time")]
        public List<string> Time { get; init; } = [];

        [JsonPropertyName("temperature_2m_max")]
        public List<double> Temperature2mMax { get; init; } = [];

        [JsonPropertyName("temperature_2m_min")]
        public List<double> Temperature2mMin { get; init; } = [];

        [JsonPropertyName("weather_code")]
        public List<int> WeatherCode { get; init; } = [];
    }
}
