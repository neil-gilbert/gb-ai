using Hyoka.Application.Models;

namespace Hyoka.Application.Abstractions;

public interface IDashboardPreferencesService
{
    Task<HubPreferences> GetAsync(Guid userId, CancellationToken ct);
    Task<HubPreferences> SaveAsync(Guid userId, HubPreferences preferences, CancellationToken ct);
}
