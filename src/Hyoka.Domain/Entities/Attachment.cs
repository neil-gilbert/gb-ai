namespace Hyoka.Domain.Entities;

public sealed class Attachment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User? User { get; set; }

    public Guid? ChatId { get; set; }
    public Chat? Chat { get; set; }

    public string OriginalFileName { get; set; } = string.Empty;
    public string MimeType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string StorageKey { get; set; } = string.Empty;
    public string Status { get; set; } = "pending";
    public string? ExtractedText { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
