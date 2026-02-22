namespace Hyoka.Domain.Entities;

public sealed class Subscription
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User? User { get; set; }

    public Guid PlanId { get; set; }
    public Plan? Plan { get; set; }

    public string StripeCustomerId { get; set; } = string.Empty;
    public string StripeSubscriptionId { get; set; } = string.Empty;
    public string Status { get; set; } = "active";
    public DateTime PeriodStartUtc { get; set; } = DateTime.UtcNow;
    public DateTime PeriodEndUtc { get; set; } = DateTime.UtcNow.AddMonths(1);
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
