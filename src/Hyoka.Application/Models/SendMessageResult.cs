namespace Hyoka.Application.Models;

public sealed class SendMessageResult
{
    public required Guid UserMessageId { get; init; }
    public required Guid AssistantMessageId { get; init; }
    public required string AssistantText { get; init; }
    public int InputTokens { get; init; }
    public int OutputTokens { get; init; }
    public decimal CreditsUsed { get; init; }
}
