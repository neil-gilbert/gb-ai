namespace Hyoka.Domain.Entities;

public sealed class UsageLedgerEntry
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public DateOnly DayUtc { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);
    public string MonthCycleKey { get; set; } = string.Empty;
    public int RequestCount { get; set; }
    public decimal CreditsUsed { get; set; }
    public string ModelKey { get; set; } = string.Empty;
    public Guid SourceMessageId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
