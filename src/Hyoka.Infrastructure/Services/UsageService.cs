using Hyoka.Application.Abstractions;
using Hyoka.Application.Models;
using Hyoka.Application.Services;
using Hyoka.Domain.Entities;
using Hyoka.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using MySqlConnector;

namespace Hyoka.Infrastructure.Services;

public sealed class UsageService(HyokaDbContext db, IClock clock) : IUsageService
{
    public async Task<QuotaSnapshot> GetSnapshotAsync(Guid userId, PlanUsageContext plan, CancellationToken ct)
    {
        try
        {
            var day = DateOnly.FromDateTime(clock.UtcNow);

            var daily = await db.DailyCounters
                .FirstOrDefaultAsync(x => x.UserId == userId && x.DayUtc == day, ct);

            var monthly = await db.MonthlyCounters
                .FirstOrDefaultAsync(x => x.UserId == userId && x.CycleKey == plan.MonthCycleKey, ct);

            return new QuotaSnapshot
            {
                DailyRequestsUsed = daily?.RequestCount ?? 0,
                MonthlyRequestsUsed = monthly?.RequestCount ?? 0,
                DailyCreditsUsed = daily?.CreditsUsed ?? 0,
                MonthlyCreditsUsed = monthly?.CreditsUsed ?? 0,
                DailyRequestLimit = plan.RequestsPerDay,
                MonthlyRequestLimit = plan.RequestsPerMonth,
                DailyCreditLimit = plan.CreditsPerDay,
                MonthlyCreditLimit = plan.CreditsPerMonth
            };
        }
        catch (Exception ex) when (IsMissingUsageTable(ex))
        {
            return new QuotaSnapshot
            {
                DailyRequestsUsed = 0,
                MonthlyRequestsUsed = 0,
                DailyCreditsUsed = 0,
                MonthlyCreditsUsed = 0,
                DailyRequestLimit = plan.RequestsPerDay,
                MonthlyRequestLimit = plan.RequestsPerMonth,
                DailyCreditLimit = plan.CreditsPerDay,
                MonthlyCreditLimit = plan.CreditsPerMonth
            };
        }
    }

    public async Task<QuotaDecision> EvaluateBeforeRequestAsync(Guid userId, PlanUsageContext plan, CancellationToken ct)
    {
        var snapshot = await GetSnapshotAsync(userId, plan, ct);

        if (snapshot.DailyRequestsUsed >= snapshot.DailyRequestLimit)
        {
            return QuotaDecision.Deny("Daily request limit reached.");
        }

        if (snapshot.MonthlyRequestsUsed >= snapshot.MonthlyRequestLimit)
        {
            return QuotaDecision.Deny("Monthly request limit reached.");
        }

        if (snapshot.DailyCreditsUsed >= snapshot.DailyCreditLimit)
        {
            return QuotaDecision.Deny("Daily credit limit reached.");
        }

        if (snapshot.MonthlyCreditsUsed >= snapshot.MonthlyCreditLimit)
        {
            return QuotaDecision.Deny("Monthly credit limit reached.");
        }

        return QuotaDecision.Permit();
    }

    public async Task<decimal> RecordUsageAsync(UsageRecordRequest request, CancellationToken ct)
    {
        var credits = QuotaCalculator.ComputeCredits(
            request.InputTokens,
            request.OutputTokens,
            request.InputWeight,
            request.OutputWeight);

        try
        {
            var day = DateOnly.FromDateTime(clock.UtcNow);

            var daily = await db.DailyCounters
                .FirstOrDefaultAsync(x => x.UserId == request.UserId && x.DayUtc == day, ct);

            if (daily is null)
            {
                daily = new DailyCounter
                {
                    UserId = request.UserId,
                    DayUtc = day
                };
                db.DailyCounters.Add(daily);
            }

            daily.RequestCount += 1;
            daily.CreditsUsed += credits;
            daily.UpdatedAtUtc = clock.UtcNow;

            var monthly = await db.MonthlyCounters
                .FirstOrDefaultAsync(x => x.UserId == request.UserId && x.CycleKey == request.MonthCycleKey, ct);

            if (monthly is null)
            {
                monthly = new MonthlyCounter
                {
                    UserId = request.UserId,
                    CycleKey = request.MonthCycleKey
                };
                db.MonthlyCounters.Add(monthly);
            }

            monthly.RequestCount += 1;
            monthly.CreditsUsed += credits;
            monthly.UpdatedAtUtc = clock.UtcNow;

            db.UsageLedger.Add(new UsageLedgerEntry
            {
                UserId = request.UserId,
                DayUtc = day,
                MonthCycleKey = request.MonthCycleKey,
                RequestCount = 1,
                CreditsUsed = credits,
                ModelKey = request.ModelKey,
                SourceMessageId = request.SourceMessageId,
                CreatedAtUtc = clock.UtcNow
            });

            await db.SaveChangesAsync(ct);
        }
        catch (Exception ex) when (IsMissingUsageTable(ex))
        {
            // Legacy schemas may miss usage tables; keep chat flow working without failing the request.
        }

        return credits;
    }

    private static bool IsMissingUsageTable(Exception ex)
    {
        for (var current = ex; current is not null; current = current.InnerException)
        {
            if (current is MySqlException mySqlEx && mySqlEx.Number == 1146)
            {
                return true;
            }

            var message = current.Message;
            if (message.Contains("doesn't exist", StringComparison.OrdinalIgnoreCase)
                && (message.Contains("DailyCounters", StringComparison.OrdinalIgnoreCase)
                    || message.Contains("MonthlyCounters", StringComparison.OrdinalIgnoreCase)
                    || message.Contains("UsageLedger", StringComparison.OrdinalIgnoreCase)))
            {
                return true;
            }
        }

        return false;
    }
}
