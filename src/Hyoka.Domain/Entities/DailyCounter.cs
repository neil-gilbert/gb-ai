namespace Hyoka.Domain.Entities;

public sealed class DailyCounter
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public DateOnly DayUtc { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);
    public int RequestCount { get; set; }
    public decimal CreditsUsed { get; set; }
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
