namespace Hyoka.Application.Models;

public sealed class ProviderChatResult
{
    public required string ResponseText { get; init; }
    public int InputTokens { get; init; }
    public int OutputTokens { get; init; }
    public string RawPayloadJson { get; init; } = "{}";
}
