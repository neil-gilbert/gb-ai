using System.Text.Json;
using Hyoka.Application.Abstractions;
using Hyoka.Application.Models;
using Hyoka.Domain.Entities;
using Hyoka.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Hyoka.Infrastructure.Services;

public sealed class DashboardPreferencesService(HyokaDbContext db) : IDashboardPreferencesService
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    public async Task<HubPreferences> GetAsync(Guid userId, CancellationToken ct)
    {
        var entity = await db.DashboardPreferences.FirstOrDefaultAsync(x => x.UserId == userId, ct);
        if (entity is null)
        {
            return HubPreferences.Empty();
        }

        var parsed = Deserialize(entity.ConfigurationJson);
        return Normalize(new HubPreferences
        {
            OrderedWidgetKeys = parsed.OrderedWidgetKeys,
            Location = parsed.Location,
            UpdatedAtUtc = entity.UpdatedAtUtc
        });
    }

    public async Task<HubPreferences> SaveAsync(Guid userId, HubPreferences preferences, CancellationToken ct)
    {
        var normalized = Normalize(new HubPreferences
        {
            OrderedWidgetKeys = preferences.OrderedWidgetKeys,
            Location = preferences.Location,
            UpdatedAtUtc = DateTime.UtcNow
        });
        var payload = JsonSerializer.Serialize(normalized, SerializerOptions);

        var entity = await db.DashboardPreferences.FirstOrDefaultAsync(x => x.UserId == userId, ct);
        if (entity is null)
        {
            entity = new DashboardPreference
            {
                UserId = userId
            };
            db.DashboardPreferences.Add(entity);
        }

        entity.ConfigurationJson = payload;
        entity.UpdatedAtUtc = normalized.UpdatedAtUtc;
        await db.SaveChangesAsync(ct);

        return normalized;
    }

    private static HubPreferences Deserialize(string configurationJson)
    {
        try
        {
            return JsonSerializer.Deserialize<HubPreferences>(configurationJson, SerializerOptions) ?? HubPreferences.Empty();
        }
        catch (JsonException)
        {
            return HubPreferences.Empty();
        }
    }

    private static HubPreferences Normalize(HubPreferences preferences)
    {
        var uniqueKeys = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var key in preferences.OrderedWidgetKeys ?? [])
        {
            if (!WidgetKeys.IsKnown(key) || !seen.Add(key))
            {
                continue;
            }

            uniqueKeys.Add(WidgetKeys.All.First(x => string.Equals(x, key, StringComparison.OrdinalIgnoreCase)));
        }

        return new HubPreferences
        {
            OrderedWidgetKeys = uniqueKeys,
            Location = NormalizeLocation(preferences.Location),
            UpdatedAtUtc = preferences.UpdatedAtUtc == default ? DateTime.UtcNow : preferences.UpdatedAtUtc
        };
    }

    private static WidgetLocationPreference? NormalizeLocation(WidgetLocationPreference? location)
    {
        if (location is null
            || double.IsNaN(location.Latitude)
            || double.IsInfinity(location.Latitude)
            || double.IsNaN(location.Longitude)
            || double.IsInfinity(location.Longitude)
            || location.Latitude < -90
            || location.Latitude > 90
            || location.Longitude < -180
            || location.Longitude > 180)
        {
            return null;
        }

        var source = location.Source.Trim().ToLowerInvariant();
        if (source is not ("browser" or "ip" or "manual"))
        {
            source = "manual";
        }

        var locality = Clean(location.Locality, 80);
        var subdivision = Clean(location.PrincipalSubdivision, 80);
        var countryCode = Clean(location.CountryCode, 8).ToUpperInvariant();
        var label = Clean(location.Label, 160);
        if (string.IsNullOrWhiteSpace(label))
        {
            label = string.Join(", ", new[] { locality, subdivision, countryCode }.Where(x => !string.IsNullOrWhiteSpace(x)));
        }

        return new WidgetLocationPreference
        {
            Source = source,
            Label = label,
            Latitude = Math.Round(location.Latitude, 4),
            Longitude = Math.Round(location.Longitude, 4),
            Locality = locality,
            PrincipalSubdivision = subdivision,
            CountryCode = string.IsNullOrWhiteSpace(countryCode) ? "GB" : countryCode,
            Postcode = Clean(location.Postcode, 32),
            Timezone = string.IsNullOrWhiteSpace(location.Timezone) ? "UTC" : Clean(location.Timezone, 64)
        };
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
}
