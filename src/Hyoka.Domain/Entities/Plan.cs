namespace Hyoka.Domain.Entities;

public sealed class Plan
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string StripePriceId { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;

    public int RequestsPerMinute { get; set; }
    public int RequestsPerDay { get; set; }
    public int RequestsPerMonth { get; set; }

    public decimal CreditsPerDay { get; set; }
    public decimal CreditsPerMonth { get; set; }

    public decimal MonthlyPriceUsd { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public ICollection<Subscription> Subscriptions { get; set; } = new List<Subscription>();
}
