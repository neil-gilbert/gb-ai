using System.Net;
using Hyoka.Application.Abstractions;
using Hyoka.Application.Models;
using Hyoka.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Hyoka.IntegrationTests;

public sealed class ApiSmokeTests : IClassFixture<HyokaApiFactory>
{
    private readonly HyokaApiFactory _factory;

    public ApiSmokeTests(HyokaApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Health_ReturnsOk()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task AuthMe_ReturnsUserAndPlan_ForDevAuth()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("x-dev-user-id", "integration-user");
        client.DefaultRequestHeaders.Add("x-dev-email", "integration@example.com");

        var response = await client.GetAsync("/api/v1/auth/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        Assert.Contains("integration@example.com", json);
        Assert.Contains("Free", json);
    }
}

public sealed class HyokaApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(Microsoft.AspNetCore.Hosting.IWebHostBuilder builder)
    {
        builder.UseSetting("Database:Provider", "InMemory");
        builder.UseSetting("Database:Name", "hyoka-integration-tests");
        builder.UseSetting("Auth:EnableDevAuth", "true");

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<IWeatherWidgetService>();
            services.RemoveAll<INewsWidgetService>();
            services.AddScoped<IWeatherWidgetService, FakeWeatherWidgetService>();
            services.AddScoped<INewsWidgetService, FakeNewsWidgetService>();

            using var scope = services.BuildServiceProvider().CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<HyokaDbContext>();
            db.Database.EnsureDeleted();
            DbSeeder.SeedAsync(db).GetAwaiter().GetResult();
        });
    }

    private sealed class FakeWeatherWidgetService : IWeatherWidgetService
    {
        public Task<WeatherWidgetData> GetForecastAsync(double latitude, double longitude, string timezone, bool refresh, CancellationToken ct)
        {
            return Task.FromResult(new WeatherWidgetData
            {
                Timezone = timezone,
                Current = new WeatherCurrentConditions
                {
                    Time = "2026-03-22T10:00",
                    TemperatureC = 12,
                    ApparentTemperatureC = 10,
                    WindSpeedKph = 14,
                    WeatherCode = 2,
                    Condition = "Partly cloudy",
                    IsDay = true
                },
                Forecast =
                [
                    new WeatherForecastDay
                    {
                        Date = "2026-03-22",
                        MinTemperatureC = 6,
                        MaxTemperatureC = 13,
                        WeatherCode = 2,
                        Condition = "Partly cloudy"
                    }
                ]
            });
        }

        public Task<IReadOnlyList<WidgetLocationSearchResult>> SearchLocationsAsync(string query, CancellationToken ct)
        {
            return Task.FromResult<IReadOnlyList<WidgetLocationSearchResult>>(
            [
                new WidgetLocationSearchResult
                {
                    Label = "Leeds, England, GB",
                    Latitude = 53.7997,
                    Longitude = -1.5492,
                    Locality = "Leeds",
                    PrincipalSubdivision = "England",
                    CountryCode = "GB",
                    Timezone = "Europe/London"
                }
            ]);
        }
    }

    private sealed class FakeNewsWidgetService : INewsWidgetService
    {
        public Task<NewsWidgetData> GetHeadlinesAsync(string locality, string principalSubdivision, string countryCode, bool refresh, CancellationToken ct)
        {
            return Task.FromResult(new NewsWidgetData
            {
                IsAvailable = true,
                Mode = "local-search",
                QueryLabel = $"{locality}, {principalSubdivision}",
                Headlines =
                [
                    new NewsHeadline
                    {
                        Title = "Test headline",
                        Description = "Summary",
                        Url = "https://example.com/headline",
                        Source = "Test Source",
                        PublishedAtUtc = DateTime.UtcNow
                    }
                ]
            });
        }
    }
}
