using Hyoka.Application.Abstractions;
using Hyoka.Application.Models;

namespace Hyoka.Infrastructure.Services.Providers;

public sealed class MockProviderClient(ITokenEstimator tokenEstimator) : IModelProviderClient
{
    public Task<ProviderChatResult> CompleteAsync(ProviderChatRequest request, CancellationToken ct)
    {
        _ = ct;

        var latestPrompt = request.Messages.LastOrDefault(m => m.Role == "user")?.Content ?? string.Empty;
        var answer = latestPrompt.Length == 0
            ? "I did not receive a prompt."
            : $"(Mock provider) You said: {latestPrompt}\n\nThis is a placeholder response. Configure OpenAI/Anthropic/OpenRouter API keys to get real model output.";

        var inputTokens = tokenEstimator.EstimateTokens(latestPrompt);
        var outputTokens = tokenEstimator.EstimateTokens(answer);

        return Task.FromResult(new ProviderChatResult
        {
            ResponseText = answer,
            InputTokens = inputTokens,
            OutputTokens = outputTokens,
            RawPayloadJson = "{}"
        });
    }

    public async IAsyncEnumerable<ProviderStreamChunk> StreamAsync(ProviderChatRequest request, [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct)
    {
        var result = await CompleteAsync(request, ct);
        foreach (var token in result.ResponseText.Split(' '))
        {
            ct.ThrowIfCancellationRequested();
            yield return new ProviderStreamChunk(token + " ");
            await Task.Delay(15, ct);
        }
    }
}
