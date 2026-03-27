using System.Text;
using System.Text.RegularExpressions;
using Hyoka.Application.Abstractions;
using Hyoka.Application.Models;
using Hyoka.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Hyoka.Infrastructure.Services;

public sealed class MemoryService(HyokaDbContext db, IClock clock) : IMemoryService
{
    private static readonly Regex NameRegex = new(@"my name is\s+([A-Za-z\-']{2,40})", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex PreferenceRegex = new(@"i (?:prefer|like)\s+([^\.\!\?]{3,80})", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private const string PromptFileName = "chat-personality-and-guardrails.md";
    private readonly string baseSystemPrompt = LoadBaseSystemPrompt();

    public async Task<string> BuildSystemContextAsync(Guid userId, Guid chatId, WidgetLocationPreference? location, CancellationToken ct)
    {
        var facts = await db.MemoryFacts
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.UpdatedAtUtc)
            .Take(8)
            .ToListAsync(ct);

        var summary = await db.ChatSummaries.FirstOrDefaultAsync(x => x.ChatId == chatId, ct);

        var sb = new StringBuilder();
        sb.AppendLine(baseSystemPrompt);
        sb.AppendLine();

        if (facts.Count > 0)
        {
            sb.AppendLine("Known user facts:");
            foreach (var fact in facts)
            {
                sb.AppendLine($"- {fact.Key}: {fact.Value}");
            }
            sb.AppendLine();
        }

        var normalizedLocation = NormalizeLocation(location);
        if (normalizedLocation is not null)
        {
            sb.AppendLine("User location context:");
            sb.AppendLine($"- Label: {normalizedLocation.Label}");
            sb.AppendLine($"- Locality: {normalizedLocation.Locality}");
            sb.AppendLine($"- Region: {normalizedLocation.PrincipalSubdivision}");
            sb.AppendLine($"- Country code: {normalizedLocation.CountryCode}");
            sb.AppendLine($"- Timezone: {normalizedLocation.Timezone}");
            sb.AppendLine($"- Coordinates: {normalizedLocation.Latitude:F4}, {normalizedLocation.Longitude:F4}");
            sb.AppendLine($"- Precision: {(normalizedLocation.Source == "ip" ? "approximate" : "user-selected")}");
            sb.AppendLine("Use this location as the user's current area when location is relevant. Do not claim more precision than provided.");
            sb.AppendLine();
        }

        if (!string.IsNullOrWhiteSpace(summary?.SummaryText))
        {
            sb.AppendLine("Conversation summary:");
            sb.AppendLine(summary.SummaryText);
        }

        return sb.ToString().Trim();
    }

    private static string LoadBaseSystemPrompt()
    {
        var candidatePaths = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "Prompts", PromptFileName),
            Path.Combine(AppContext.BaseDirectory, PromptFileName),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "docs", PromptFileName))
        };

        foreach (var path in candidatePaths)
        {
            if (!File.Exists(path))
            {
                continue;
            }

            var content = File.ReadAllText(path).Trim();
            if (!string.IsNullOrWhiteSpace(content))
            {
                return content;
            }
        }

        return """
        You are GB-AI, a helpful assistant.
        Be warm, polite, and clear. Keep responses friendly and respectful.
        Refuse hateful or abusive language and invite the user to rephrase respectfully.
        """;
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
            label = string.Join(", ", new[] { locality, subdivision, countryCode }.Where(value => !string.IsNullOrWhiteSpace(value)));
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

        var trimmed = value.Trim().Replace('\n', ' ').Replace('\r', ' ');
        return trimmed.Length <= maxLength ? trimmed : trimmed[..maxLength];
    }

    public async Task UpsertConversationSummaryAsync(Guid chatId, string conversationText, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(conversationText))
        {
            return;
        }

        var trimmed = conversationText.Length <= 1500
            ? conversationText
            : conversationText[^1500..];

        var summary = await db.ChatSummaries.FirstOrDefaultAsync(x => x.ChatId == chatId, ct);
        if (summary is null)
        {
            db.ChatSummaries.Add(new Domain.Entities.ChatSummary
            {
                ChatId = chatId,
                SummaryText = trimmed,
                UpdatedAtUtc = clock.UtcNow
            });
        }
        else
        {
            summary.SummaryText = trimmed;
            summary.UpdatedAtUtc = clock.UtcNow;
        }

        await db.SaveChangesAsync(ct);
    }

    public async Task ExtractAndUpsertFactsAsync(Guid userId, string userMessage, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(userMessage))
        {
            return;
        }

        var updates = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        var nameMatch = NameRegex.Match(userMessage);
        if (nameMatch.Success)
        {
            updates["name"] = nameMatch.Groups[1].Value.Trim();
        }

        var preferenceMatch = PreferenceRegex.Match(userMessage);
        if (preferenceMatch.Success)
        {
            updates["preference"] = preferenceMatch.Groups[1].Value.Trim();
        }

        if (updates.Count == 0)
        {
            return;
        }

        foreach (var (key, value) in updates)
        {
            var existing = await db.MemoryFacts.FirstOrDefaultAsync(x => x.UserId == userId && x.Key == key, ct);
            if (existing is null)
            {
                db.MemoryFacts.Add(new Domain.Entities.MemoryFact
                {
                    UserId = userId,
                    Key = key,
                    Value = value,
                    Confidence = 0.85m,
                    UpdatedAtUtc = clock.UtcNow
                });
            }
            else
            {
                existing.Value = value;
                existing.UpdatedAtUtc = clock.UtcNow;
            }
        }

        await db.SaveChangesAsync(ct);
    }
}
