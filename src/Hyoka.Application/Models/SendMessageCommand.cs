namespace Hyoka.Application.Models;

public sealed class SendMessageCommand
{
    public required Guid UserId { get; init; }
    public required Guid ChatId { get; init; }
    public required string ModelKey { get; init; }
    public required string Text { get; init; }
    public required IReadOnlyList<Guid> AttachmentIds { get; init; }
}
