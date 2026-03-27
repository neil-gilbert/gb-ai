using System.Net;
using System.Net.Http.Json;
using Hyoka.Application.Abstractions;
using Hyoka.Application.Models;
using Hyoka.Api.Contracts;
using Hyoka.Domain.Entities;
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

    [Fact]
    public async Task ChatStream_IncludesLocationContext_WhenSentByClient()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("x-dev-user-id", "integration-user");
        client.DefaultRequestHeaders.Add("x-dev-email", "integration@example.com");

        var gateway = _factory.Services.GetRequiredService<HyokaApiFactory.FakeProviderGateway>();
        gateway.Reset();

        var createResponse = await client.PostAsJsonAsync("/api/v1/chats", new CreateChatRequest());
        createResponse.EnsureSuccessStatusCode();
        var chat = await createResponse.Content.ReadFromJsonAsync<HyokaApiFactory.CreatedChatResponse>();
        Assert.NotNull(chat);

        var streamResponse = await client.PostAsJsonAsync($"/api/v1/chats/{chat!.Id}/messages/stream", new
        {
            modelKey = "gpt-4o-mini",
            text = "What should I do nearby today?",
            attachmentIds = Array.Empty<Guid>(),
            location = new
            {
                source = "manual",
                label = "Leeds, England, GB",
                latitude = 53.7997,
                longitude = -1.5492,
                locality = "Leeds",
                principalSubdivision = "England",
                countryCode = "GB",
                timezone = "Europe/London"
            }
        });

        Assert.Equal(HttpStatusCode.OK, streamResponse.StatusCode);
        var payload = await streamResponse.Content.ReadAsStringAsync();
        Assert.Contains("assistant.completed", payload);
        Assert.Contains("Leeds, England, GB", gateway.LastSystemPrompt);
        Assert.Contains("Use this location as the user's current area", gateway.LastSystemPrompt);
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
            services.RemoveAll<IProviderGateway>();
            services.AddScoped<IWeatherWidgetService, FakeWeatherWidgetService>();
            services.AddScoped<INewsWidgetService, FakeNewsWidgetService>();
            services.AddSingleton<FakeProviderGateway>();
            services.AddSingleton<IProviderGateway>(sp => sp.GetRequiredService<FakeProviderGateway>());

            using var scope = services.BuildServiceProvider().CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<HyokaDbContext>();
            db.Database.EnsureDeleted();
            DbSeeder.SeedAsync(db).GetAwaiter().GetResult();
        });
    }

    public sealed class FakeProviderGateway : IProviderGateway
    {
        public string LastSystemPrompt { get; private set; } = string.Empty;

        public void Reset()
        {
            LastSystemPrompt = string.Empty;
        }

        public Task<ProviderChatResult> CompleteWithFallbackAsync(
            ModelCatalogEntry primaryModel,
            ModelCatalogEntry? fallbackModel,
            ProviderChatRequest request,
            CancellationToken ct)
        {
            LastSystemPrompt = request.SystemPrompt ?? string.Empty;

            return Task.FromResult(new ProviderChatResult
            {
                ResponseText = "Integration test response",
                InputTokens = 12,
                OutputTokens = 24
            });
        }
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

    public sealed class CreatedChatResponse
    {
        public Guid Id { get; init; }
    }
}
