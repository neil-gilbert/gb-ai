using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Hyoka.Application.Abstractions;
using Hyoka.Application.Models;
using Hyoka.Infrastructure.Options;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Hyoka.Infrastructure.Services;

public sealed class GNewsWidgetService(
    IHttpClientFactory httpClientFactory,
    IOptions<WidgetsOptions> options,
    IMemoryCache cache) : INewsWidgetService
{
    private static readonly TimeSpan NewsCacheDuration = TimeSpan.FromMinutes(15);
    private readonly WidgetsOptions _options = options.Value;

    public async Task<NewsWidgetData> GetHeadlinesAsync(
        string locality,
        string principalSubdivision,
        string countryCode,
        bool refresh,
        CancellationToken ct)
    {
        var normalizedLocality = Clean(locality, 80);
        var normalizedSubdivision = Clean(principalSubdivision, 80);
        var normalizedCountryCode = string.IsNullOrWhiteSpace(countryCode) ? "gb" : Clean(countryCode, 8).ToLowerInvariant();
        var cacheKey = WidgetCacheKeys.News(normalizedLocality, normalizedSubdivision, normalizedCountryCode);

        if (!refresh && cache.TryGetValue<NewsWidgetData>(cacheKey, out var cached) && cached is not null)
        {
            return cached;
        }

        if (string.IsNullOrWhiteSpace(_options.News.ApiKey))
        {
            return new NewsWidgetData
            {
                IsAvailable = false,
                Mode = "country-fallback",
                QueryLabel = BuildQueryLabel(normalizedLocality, normalizedSubdivision, normalizedCountryCode.ToUpperInvariant()),
                Message = "News widget is unavailable until the server API key is configured.",
                FetchedAtUtc = DateTime.UtcNow
            };
        }

        using var http = httpClientFactory.CreateClient();
        http.Timeout = TimeSpan.FromSeconds(Math.Max(10, _options.News.TimeoutSeconds));
        http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        var baseUrl = _options.News.BaseUrl.TrimEnd('/');
        var localQuery = BuildLocalQuery(normalizedLocality, normalizedSubdivision);
        var localResponse = string.IsNullOrWhiteSpace(localQuery)
            ? null
            : await FetchAsync(http, $"{baseUrl}/search?q={Uri.EscapeDataString(localQuery)}&lang=en&country={normalizedCountryCode}&max=5&apikey={_options.News.ApiKey}", ct);

        NewsWidgetData data;
        if (localResponse?.Articles.Count >= 3)
        {
            data = new NewsWidgetData
            {
                IsAvailable = true,
                Mode = "local-search",
                QueryLabel = BuildQueryLabel(normalizedLocality, normalizedSubdivision, normalizedCountryCode.ToUpperInvariant()),
                Headlines = localResponse.Articles.Select(MapHeadline).ToList(),
                FetchedAtUtc = DateTime.UtcNow
            };
        }
        else
        {
            var fallbackResponse = await FetchAsync(http, $"{baseUrl}/top-headlines?lang=en&country={normalizedCountryCode}&max=5&apikey={_options.News.ApiKey}", ct)
                ?? new GNewsResponse();

            data = new NewsWidgetData
            {
                IsAvailable = true,
                Mode = "country-fallback",
                QueryLabel = string.IsNullOrWhiteSpace(normalizedLocality)
                    ? normalizedCountryCode.ToUpperInvariant()
                    : $"{normalizedLocality} nearby",
                Headlines = fallbackResponse.Articles.Select(MapHeadline).ToList(),
                Message = fallbackResponse.Articles.Count == 0 ? "No headlines were available for this area." : null,
                FetchedAtUtc = DateTime.UtcNow
            };
        }

        cache.Set(cacheKey, data, NewsCacheDuration);
        return data;
    }

    private static async Task<GNewsResponse?> FetchAsync(HttpClient http, string url, CancellationToken ct)
    {
        using var response = await http.GetAsync(url, ct);
        var body = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(string.IsNullOrWhiteSpace(body) ? "News request failed." : body);
        }

        return System.Text.Json.JsonSerializer.Deserialize<GNewsResponse>(body, new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web));
    }

    private static NewsHeadline MapHeadline(GNewsArticle article)
    {
        return new NewsHeadline
        {
            Title = article.Title ?? string.Empty,
            Description = article.Description ?? string.Empty,
            Url = article.Url ?? string.Empty,
            Source = article.Source?.Name ?? "Unknown source",
            ImageUrl = article.Image,
            PublishedAtUtc = article.PublishedAtUtc ?? DateTime.UtcNow
        };
    }

    private static string BuildLocalQuery(string locality, string principalSubdivision)
    {
        if (string.IsNullOrWhiteSpace(locality) && string.IsNullOrWhiteSpace(principalSubdivision))
        {
            return string.Empty;
        }

        if (string.IsNullOrWhiteSpace(principalSubdivision))
        {
            return $"\"{locality}\"";
        }

        if (string.IsNullOrWhiteSpace(locality))
        {
            return $"\"{principalSubdivision}\"";
        }

        return $"\"{locality}\" AND \"{principalSubdivision}\"";
    }

    private static string BuildQueryLabel(string locality, string principalSubdivision, string countryCode)
    {
        return string.Join(", ", new[] { locality, principalSubdivision, countryCode }.Where(x => !string.IsNullOrWhiteSpace(x)));
    }

    private static string Clean(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var trimmed = value.Trim();
        return trimmed.Length <= maxLength ? trimmed : trimmed[..maxLength];
    }

    private sealed class GNewsResponse
    {
        [JsonPropertyName("articles")]
        public List<GNewsArticle> Articles { get; init; } = [];
    }

    private sealed class GNewsArticle
    {
        [JsonPropertyName("title")]
        public string? Title { get; init; }

        [JsonPropertyName("description")]
        public string? Description { get; init; }

        [JsonPropertyName("url")]
        public string? Url { get; init; }

        [JsonPropertyName("image")]
        public string? Image { get; init; }

        [JsonPropertyName("publishedAt")]
        public DateTime? PublishedAtUtc { get; init; }

        [JsonPropertyName("source")]
        public GNewsSource? Source { get; init; }
    }

    private sealed class GNewsSource
    {
        [JsonPropertyName("name")]
        public string? Name { get; init; }
    }
}
