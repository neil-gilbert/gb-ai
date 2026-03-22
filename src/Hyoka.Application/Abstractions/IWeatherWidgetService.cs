using Hyoka.Application.Models;

namespace Hyoka.Application.Abstractions;

public interface IWeatherWidgetService
{
    Task<IReadOnlyList<WidgetLocationSearchResult>> SearchLocationsAsync(string query, CancellationToken ct);
    Task<WeatherWidgetData> GetForecastAsync(double latitude, double longitude, string timezone, bool refresh, CancellationToken ct);
}
