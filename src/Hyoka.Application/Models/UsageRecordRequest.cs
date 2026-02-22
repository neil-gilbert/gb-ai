namespace Hyoka.Application.Models;

public sealed class UsageRecordRequest
{
    public required Guid UserId { get; init; }
    public required string ModelKey { get; init; }
    public required Guid SourceMessageId { get; init; }
    public int InputTokens { get; init; }
    public int OutputTokens { get; init; }
    public decimal InputWeight { get; init; }
    public decimal OutputWeight { get; init; }
    public required string MonthCycleKey { get; init; }
}
