using Hyoka.Application.Models;

namespace Hyoka.Application.Abstractions;

public interface IMemoryService
{
    Task<string> BuildSystemContextAsync(Guid userId, Guid chatId, CancellationToken ct);
    Task UpsertConversationSummaryAsync(Guid chatId, string conversationText, CancellationToken ct);
    Task ExtractAndUpsertFactsAsync(Guid userId, string userMessage, CancellationToken ct);
}
