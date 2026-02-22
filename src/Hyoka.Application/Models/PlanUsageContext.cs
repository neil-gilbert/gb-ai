namespace Hyoka.Application.Models;

public sealed class PlanUsageContext
{
    public required string PlanName { get; init; }
    public required int RequestsPerMinute { get; init; }
    public required int RequestsPerDay { get; init; }
    public required int RequestsPerMonth { get; init; }
    public required decimal CreditsPerDay { get; init; }
    public required decimal CreditsPerMonth { get; init; }
    public required string MonthCycleKey { get; init; }
}
