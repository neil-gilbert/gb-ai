using Hyoka.Application.Models;

namespace Hyoka.Application.Abstractions;

public interface IUsageService
{
    Task<QuotaSnapshot> GetSnapshotAsync(Guid userId, PlanUsageContext plan, CancellationToken ct);
    Task<QuotaDecision> EvaluateBeforeRequestAsync(Guid userId, PlanUsageContext plan, CancellationToken ct);
    Task<decimal> RecordUsageAsync(UsageRecordRequest request, CancellationToken ct);
}
