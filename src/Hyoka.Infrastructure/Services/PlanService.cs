using Hyoka.Application.Abstractions;
using Hyoka.Application.Models;
using Hyoka.Domain.Entities;
using Hyoka.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Hyoka.Infrastructure.Services;

public sealed class PlanService(HyokaDbContext db, IClock clock) : IPlanService
{
    public async Task<PlanUsageContext> GetUsageContextAsync(Guid userId, CancellationToken ct)
    {
        var plan = await GetActivePlanAsync(userId, ct);
        var now = clock.UtcNow;

        var subscription = await db.Subscriptions
            .Where(x => x.UserId == userId && x.Status == "active" && x.PeriodEndUtc > now)
            .OrderByDescending(x => x.PeriodEndUtc)
            .FirstOrDefaultAsync(ct);

        var cycleStart = subscription?.PeriodStartUtc.Date ?? new DateTime(now.Year, now.Month, 1);

        return new PlanUsageContext
        {
            PlanName = plan.Name,
            RequestsPerMinute = plan.RequestsPerMinute,
            RequestsPerDay = plan.RequestsPerDay,
            RequestsPerMonth = plan.RequestsPerMonth,
            CreditsPerDay = plan.CreditsPerDay,
            CreditsPerMonth = plan.CreditsPerMonth,
            MonthCycleKey = cycleStart.ToString("yyyy-MM-dd")
        };
    }

    public async Task<Plan> GetActivePlanAsync(Guid userId, CancellationToken ct)
    {
        var now = clock.UtcNow;

        var subscription = await db.Subscriptions
            .Include(x => x.Plan)
            .Where(x => x.UserId == userId && x.Status == "active" && x.PeriodEndUtc > now)
            .OrderByDescending(x => x.PeriodEndUtc)
            .FirstOrDefaultAsync(ct);

        if (subscription?.Plan is not null)
        {
            return subscription.Plan;
        }

        var freePlan = await db.Plans.FirstOrDefaultAsync(x => x.Name == "Free" && x.IsActive, ct);
        if (freePlan is null)
        {
            throw new InvalidOperationException("Free plan is not configured.");
        }

        return freePlan;
    }
}
