namespace Hyoka.Domain.Entities;

public sealed class ChatSummary
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ChatId { get; set; }
    public Chat? Chat { get; set; }

    public string SummaryText { get; set; } = string.Empty;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
