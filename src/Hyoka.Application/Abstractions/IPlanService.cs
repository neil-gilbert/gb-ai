using Hyoka.Application.Models;
using Hyoka.Domain.Entities;

namespace Hyoka.Application.Abstractions;

public interface IPlanService
{
    Task<PlanUsageContext> GetUsageContextAsync(Guid userId, CancellationToken ct);
    Task<Plan> GetActivePlanAsync(Guid userId, CancellationToken ct);
}
