using System.Text;
using System.Text.RegularExpressions;
using Hyoka.Application.Abstractions;
using Hyoka.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Hyoka.Infrastructure.Services;

public sealed class MemoryService(HyokaDbContext db, IClock clock) : IMemoryService
{
    private static readonly Regex NameRegex = new(@"my name is\s+([A-Za-z\-']{2,40})", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex PreferenceRegex = new(@"i (?:prefer|like)\s+([^\.\!\?]{3,80})", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public async Task<string> BuildSystemContextAsync(Guid userId, Guid chatId, CancellationToken ct)
    {
        var facts = await db.MemoryFacts
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.UpdatedAtUtc)
            .Take(8)
            .ToListAsync(ct);

        var summary = await db.ChatSummaries.FirstOrDefaultAsync(x => x.ChatId == chatId, ct);

        var sb = new StringBuilder();
        sb.AppendLine("You are a helpful AI assistant.");

        if (facts.Count > 0)
        {
            sb.AppendLine("Known user facts:");
            foreach (var fact in facts)
            {
                sb.AppendLine($"- {fact.Key}: {fact.Value}");
            }
        }

        if (!string.IsNullOrWhiteSpace(summary?.SummaryText))
        {
            sb.AppendLine("Conversation summary:");
            sb.AppendLine(summary.SummaryText);
        }

        return sb.ToString().Trim();
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
