using Hyoka.Application.Abstractions;
using Hyoka.Application.Models;
using Hyoka.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace Hyoka.Infrastructure.Services;

public sealed class ProviderGateway(
    IProviderClientFactory factory,
    ILogger<ProviderGateway> logger) : IProviderGateway
{
    public async Task<ProviderChatResult> CompleteWithFallbackAsync(
        ModelCatalogEntry primaryModel,
        ModelCatalogEntry? fallbackModel,
        ProviderChatRequest request,
        CancellationToken ct)
    {
        try
        {
            var client = factory.GetClient(primaryModel.Provider);
            return await client.CompleteAsync(request, ct);
        }
        catch (Exception ex) when (CanFallback(ex) && fallbackModel is not null)
        {
            logger.LogWarning(ex, "Primary provider failed for {Model}. Falling back to {FallbackModel}.", primaryModel.ModelKey, fallbackModel.ModelKey);

            var fallbackRequest = new ProviderChatRequest
            {
                ModelKey = fallbackModel.ModelKey,
                ProviderModelId = fallbackModel.ProviderModelId ?? fallbackModel.ModelKey,
                Messages = request.Messages,
                Attachments = request.Attachments,
                SystemPrompt = request.SystemPrompt,
                Stream = request.Stream
            };

            var fallbackClient = factory.GetClient(fallbackModel.Provider);
            return await fallbackClient.CompleteAsync(fallbackRequest, ct);
        }
    }

    private static bool CanFallback(Exception ex)
    {
        return ex is HttpRequestException or TaskCanceledException;
    }
}
