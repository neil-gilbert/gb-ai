namespace Hyoka.Domain.Entities;

public sealed class ModelCatalogEntry
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string ModelKey { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Provider { get; set; } = "openai";
    public string? ProviderModelId { get; set; }
    public string? FallbackModelKey { get; set; }
    public decimal InputWeight { get; set; } = 1.0m;
    public decimal OutputWeight { get; set; } = 1.0m;
    public bool Enabled { get; set; } = true;

    // Comma-separated plan names.
    public string PlanAccessCsv { get; set; } = "Free,Light,Pro";

    public IReadOnlyList<string> GetPlanAccess() => PlanAccessCsv
        .Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
}
