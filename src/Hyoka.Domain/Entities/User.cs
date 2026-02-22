namespace Hyoka.Domain.Entities;

public sealed class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string ClerkUserId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = "user";
    public string TimezoneMetadata { get; set; } = "UTC";
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public ICollection<Chat> Chats { get; set; } = new List<Chat>();
    public ICollection<Subscription> Subscriptions { get; set; } = new List<Subscription>();
    public ICollection<Attachment> Attachments { get; set; } = new List<Attachment>();
    public ICollection<MemoryFact> MemoryFacts { get; set; } = new List<MemoryFact>();
}
