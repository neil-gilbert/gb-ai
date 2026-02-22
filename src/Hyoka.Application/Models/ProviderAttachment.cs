namespace Hyoka.Application.Models;

public sealed record ProviderAttachment(string MimeType, string FileName, string StorageKey, string? ExtractedText);
