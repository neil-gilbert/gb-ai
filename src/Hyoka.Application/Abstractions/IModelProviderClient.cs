using Hyoka.Application.Models;

namespace Hyoka.Application.Abstractions;

public interface IModelProviderClient
{
    Task<ProviderChatResult> CompleteAsync(ProviderChatRequest request, CancellationToken ct);
    IAsyncEnumerable<ProviderStreamChunk> StreamAsync(ProviderChatRequest request, CancellationToken ct);
}
