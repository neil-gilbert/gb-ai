namespace Hyoka.Domain.Entities;

public sealed class Message
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ChatId { get; set; }
    public Chat? Chat { get; set; }

    public string Role { get; set; } = "user";
    public string DisplayText { get; set; } = string.Empty;
    public string RawPayloadJson { get; set; } = "{}";
    public int InputTokens { get; set; }
    public int OutputTokens { get; set; }
    public string ModelKey { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
