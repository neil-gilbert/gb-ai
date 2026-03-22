using System.Net;
using System.Net.Http.Json;
using Hyoka.Application.Abstractions;
using Hyoka.Application.Models;

namespace Hyoka.IntegrationTests;

public sealed class WidgetApiTests : IClassFixture<HyokaApiFactory>
{
    private readonly HyokaApiFactory _factory;

    public WidgetApiTests(HyokaApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task WidgetPreferences_RoundTrip_ForSignedInUser()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("x-dev-user-id", "widget-user");
        client.DefaultRequestHeaders.Add("x-dev-email", "widgets@example.com");

        var request = new HubPreferences
        {
            OrderedWidgetKeys = [WidgetKeys.WeatherLocal, WidgetKeys.NewsLocal],
            Location = new WidgetLocationPreference
            {
                Source = "manual",
                Label = "Leeds, England, GB",
                Latitude = 53.7997,
                Longitude = -1.5492,
                Locality = "Leeds",
                PrincipalSubdivision = "England",
                CountryCode = "GB",
                Timezone = "Europe/London"
            }
        };

        var putResponse = await client.PutAsJsonAsync("/api/v1/widgets/preferences", request);
        Assert.Equal(HttpStatusCode.OK, putResponse.StatusCode);

        var getResponse = await client.GetFromJsonAsync<HubPreferences>("/api/v1/widgets/preferences");
        Assert.NotNull(getResponse);
        Assert.Equal([WidgetKeys.WeatherLocal, WidgetKeys.NewsLocal], getResponse!.OrderedWidgetKeys);
        Assert.Equal("Leeds", getResponse.Location?.Locality);
    }

    [Fact]
    public async Task WidgetEndpoints_AreAvailable_ToGuestUsers()
    {
        var client = _factory.CreateClient();

        var locationSearch = await client.GetAsync("/api/v1/widgets/location/search?q=Leeds");
        var weather = await client.GetAsync("/api/v1/widgets/weather?latitude=53.7997&longitude=-1.5492&timezone=Europe%2FLondon");
        var news = await client.GetAsync("/api/v1/widgets/news?locality=Leeds&principalSubdivision=England&countryCode=GB");

        Assert.Equal(HttpStatusCode.OK, locationSearch.StatusCode);
        Assert.Equal(HttpStatusCode.OK, weather.StatusCode);
        Assert.Equal(HttpStatusCode.OK, news.StatusCode);
    }
}
