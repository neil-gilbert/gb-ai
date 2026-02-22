namespace Hyoka.Domain.Entities;

public sealed class MonthlyCounter
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string CycleKey { get; set; } = string.Empty;
    public int RequestCount { get; set; }
    public decimal CreditsUsed { get; set; }
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
