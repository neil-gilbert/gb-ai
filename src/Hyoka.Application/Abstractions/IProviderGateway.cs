using Hyoka.Application.Models;
using Hyoka.Domain.Entities;

namespace Hyoka.Application.Abstractions;

public interface IProviderGateway
{
    Task<ProviderChatResult> CompleteWithFallbackAsync(
        ModelCatalogEntry primaryModel,
        ModelCatalogEntry? fallbackModel,
        ProviderChatRequest request,
        CancellationToken ct);
}
