namespace Hyoka.Domain.Entities;

public sealed class MemoryFact
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User? User { get; set; }

    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public decimal Confidence { get; set; } = 0.8m;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
