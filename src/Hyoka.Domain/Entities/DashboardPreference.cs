namespace Hyoka.Domain.Entities;

public sealed class DashboardPreference
{
    public Guid UserId { get; set; }
    public string ConfigurationJson { get; set; } = "{}";
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
}
