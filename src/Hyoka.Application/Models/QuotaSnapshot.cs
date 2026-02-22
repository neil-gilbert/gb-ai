namespace Hyoka.Application.Models;

public sealed class QuotaSnapshot
{
    public int DailyRequestsUsed { get; init; }
    public int MonthlyRequestsUsed { get; init; }
    public decimal DailyCreditsUsed { get; init; }
    public decimal MonthlyCreditsUsed { get; init; }

    public int DailyRequestLimit { get; init; }
    public int MonthlyRequestLimit { get; init; }
    public decimal DailyCreditLimit { get; init; }
    public decimal MonthlyCreditLimit { get; init; }
}
