namespace Hyoka.Application.Models;

public sealed class ProviderChatRequest
{
    public required string ModelKey { get; init; }
    public required string ProviderModelId { get; init; }
    public required IReadOnlyList<ProviderChatMessage> Messages { get; init; }
    public required IReadOnlyList<ProviderAttachment> Attachments { get; init; }
    public string? SystemPrompt { get; init; }
    public bool Stream { get; init; }
}
