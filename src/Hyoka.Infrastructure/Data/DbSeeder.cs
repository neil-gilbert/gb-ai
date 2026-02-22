using Hyoka.Domain.Entities;
using Hyoka.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Hyoka.Infrastructure.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(HyokaDbContext db, CancellationToken ct = default)
    {
        await db.Database.EnsureCreatedAsync(ct);

        if (!await db.Plans.AnyAsync(ct))
        {
            db.Plans.AddRange(
                new Plan
                {
                    Name = "Free",
                    StripePriceId = "price_free",
                    RequestsPerMinute = 20,
                    RequestsPerDay = 60,
                    RequestsPerMonth = 1200,
                    CreditsPerDay = 60000,
                    CreditsPerMonth = 1200000,
                    MonthlyPriceUsd = 0
                },
                new Plan
                {
                    Name = "Light",
                    StripePriceId = "price_light",
                    RequestsPerMinute = 45,
                    RequestsPerDay = 240,
                    RequestsPerMonth = 6000,
                    CreditsPerDay = 300000,
                    CreditsPerMonth = 5000000,
                    MonthlyPriceUsd = 19
                },
                new Plan
                {
                    Name = "Pro",
                    StripePriceId = "price_pro",
                    RequestsPerMinute = 90,
                    RequestsPerDay = 1200,
                    RequestsPerMonth = 25000,
                    CreditsPerDay = 2000000,
                    CreditsPerMonth = 30000000,
                    MonthlyPriceUsd = 49
                }
            );
        }

        if (!await db.ModelCatalog.AnyAsync(ct))
        {
            db.ModelCatalog.AddRange(
                new ModelCatalogEntry
                {
                    ModelKey = "chatgpt-5.3",
                    DisplayName = "ChatGPT 5.3",
                    Provider = ProviderKind.OpenAi,
                    ProviderModelId = "gpt-5.3",
                    InputWeight = 1.0m,
                    OutputWeight = 2.0m,
                    PlanAccessCsv = "Free,Light,Pro"
                },
                new ModelCatalogEntry
                {
                    ModelKey = "claude-sonnet-4",
                    DisplayName = "Claude Sonnet 4",
                    Provider = ProviderKind.Anthropic,
                    ProviderModelId = "claude-sonnet-4-20250514",
                    InputWeight = 1.2m,
                    OutputWeight = 2.2m,
                    PlanAccessCsv = "Light,Pro"
                },
                new ModelCatalogEntry
                {
                    ModelKey = "openrouter-auto",
                    DisplayName = "OpenRouter Auto",
                    Provider = ProviderKind.OpenRouter,
                    ProviderModelId = "openrouter/auto",
                    InputWeight = 1.0m,
                    OutputWeight = 1.8m,
                    PlanAccessCsv = "Pro"
                }
            );
        }

        await db.SaveChangesAsync(ct);
    }
}
