using System.Net;
using System.Text;
using Hyoka.Application.Models;
using Hyoka.Infrastructure.Data;
using Hyoka.Infrastructure.Options;
using Hyoka.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Hyoka.UnitTests;

public sealed class WidgetServicesTests
{
    [Fact]
    public async Task DashboardPreferencesService_NormalizesWidgetsAndLocation()
    {
        await using var db = CreateDb();
        var service = new DashboardPreferencesService(db);
        var userId = Guid.NewGuid();

        var saved = await service.SaveAsync(userId, new HubPreferences
        {
            OrderedWidgetKeys = ["weather.local", "unknown.widget", "news.local", "weather.local"],
            Location = new WidgetLocationPreference
            {
                Source = "gps",
                Label = "",
                Latitude = 53.7997,
                Longitude = -1.5492,
                Locality = "Leeds",
                PrincipalSubdivision = "England",
                CountryCode = "gb",
                Timezone = "Europe/London"
            }
        }, CancellationToken.None);

        Assert.Equal(["weather.local", "news.local"], saved.OrderedWidgetKeys);
        Assert.NotNull(saved.Location);
        Assert.Equal("manual", saved.Location!.Source);
        Assert.Equal("Leeds, England, GB", saved.Location.Label);
        Assert.Equal("GB", saved.Location.CountryCode);
    }

    [Fact]
    public void WidgetCacheKeys_NormalizeCoordinatesAndText()
    {
        var weather = WidgetCacheKeys.Weather(51.50001, -0.12666, " Europe/London ");
        var news = WidgetCacheKeys.News(" Leeds ", " England ", " gb ");

        Assert.Equal("widgets:weather:51.500:-0.127:europe/london", weather);
        Assert.Equal("widgets:news:leeds:england:gb", news);
    }

    [Fact]
    public async Task OpenMeteoWidgetService_MapsForecastResponse()
    {
        var handler = new QueueHttpMessageHandler(
            """
            {
              "timezone": "Europe/London",
              "current": {
                "time": "2026-03-22T10:00",
                "temperature_2m": 12.4,
                "apparent_temperature": 10.8,
                "wind_speed_10m": 16.1,
                "weather_code": 2,
                "is_day": 1
              },
              "daily": {
                "time": ["2026-03-22", "2026-03-23"],
                "temperature_2m_max": [13.5, 14.0],
                "temperature_2m_min": [6.2, 7.1],
                "weather_code": [2, 61]
              }
            }
            """
        );

        var service = new OpenMeteoWidgetService(new TestHttpClientFactory(handler), new MemoryCache(new MemoryCacheOptions()));
        var forecast = await service.GetForecastAsync(51.5, -0.12, "Europe/London", refresh: true, CancellationToken.None);

        Assert.Equal("Europe/London", forecast.Timezone);
        Assert.Equal("Partly cloudy", forecast.Current.Condition);
        Assert.Equal(2, forecast.Forecast.Count);
        Assert.Equal("Rain", forecast.Forecast[1].Condition);
    }

    [Fact]
    public async Task GNewsWidgetService_FallsBackToCountryHeadlines_WhenLocalSearchIsSparse()
    {
        var handler = new QueueHttpMessageHandler(
            """
            {
              "articles": [
                {
                  "title": "One local headline",
                  "description": "Only one result",
                  "url": "https://example.com/local",
                  "publishedAt": "2026-03-22T10:00:00Z",
                  "source": { "name": "Local Source" }
                }
              ]
            }
            """,
            """
            {
              "articles": [
                {
                  "title": "UK headline one",
                  "description": "Fallback item",
                  "url": "https://example.com/uk-1",
                  "publishedAt": "2026-03-22T11:00:00Z",
                  "source": { "name": "National One" }
                },
                {
                  "title": "UK headline two",
                  "description": "Fallback item",
                  "url": "https://example.com/uk-2",
                  "publishedAt": "2026-03-22T12:00:00Z",
                  "source": { "name": "National Two" }
                }
              ]
            }
            """
        );

        var service = new GNewsWidgetService(
            new TestHttpClientFactory(handler),
            Options.Create(new WidgetsOptions
            {
                News = new WidgetNewsOptions
                {
                    BaseUrl = "https://gnews.test/api/v4",
                    ApiKey = "test-key",
                    TimeoutSeconds = 30
                }
            }),
            new MemoryCache(new MemoryCacheOptions()));

        var response = await service.GetHeadlinesAsync("Leeds", "England", "GB", refresh: true, CancellationToken.None);

        Assert.Equal("country-fallback", response.Mode);
        Assert.Equal(2, response.Headlines.Count);
        Assert.Contains(handler.Requests, request => request.Contains("/search?", StringComparison.Ordinal));
        Assert.Contains(handler.Requests, request => request.Contains("/top-headlines?", StringComparison.Ordinal));
    }

    private static HyokaDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<HyokaDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new HyokaDbContext(options);
    }

    private sealed class TestHttpClientFactory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name = "")
        {
            return new HttpClient(handler, disposeHandler: false);
        }
    }

    private sealed class QueueHttpMessageHandler(params string[] payloads) : HttpMessageHandler
    {
        private readonly Queue<string> _payloads = new(payloads);

        public List<string> Requests { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests.Add(request.RequestUri?.ToString() ?? string.Empty);
            if (_payloads.Count == 0)
            {
                throw new InvalidOperationException("No more queued responses.");
            }

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(_payloads.Dequeue(), Encoding.UTF8, "application/json")
            });
        }
    }
}
