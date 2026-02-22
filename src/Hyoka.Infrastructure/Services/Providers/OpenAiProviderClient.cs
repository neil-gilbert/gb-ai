using System.Net.Http.Json;
using System.Text.Json;
using Hyoka.Application.Abstractions;
using Hyoka.Application.Models;
using Hyoka.Infrastructure.Options;
using Microsoft.Extensions.Options;

namespace Hyoka.Infrastructure.Services.Providers;

public sealed class OpenAiProviderClient(
    IHttpClientFactory httpClientFactory,
    IOptions<ProviderRuntimeOptions> options,
    ITokenEstimator tokenEstimator) : IModelProviderClient
{
    public async Task<ProviderChatResult> CompleteAsync(ProviderChatRequest request, CancellationToken ct)
    {
        var endpoint = options.Value.OpenAI;
        if (string.IsNullOrWhiteSpace(endpoint.ApiKey))
        {
            throw new InvalidOperationException("OpenAI API key is not configured.");
        }

        using var http = httpClientFactory.CreateClient();
        http.Timeout = TimeSpan.FromSeconds(Math.Max(10, endpoint.TimeoutSeconds));
        http.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", endpoint.ApiKey);

        var url = endpoint.BaseUrl.TrimEnd('/') + "/v1/chat/completions";
        var payload = new
        {
            model = request.ProviderModelId,
            messages = ProviderMessageProjector.ToOpenAiMessages(request),
            stream = false
        };

        using var response = await http.PostAsJsonAsync(url, payload, cancellationToken: ct);
        var body = await response.Content.ReadAsStringAsync(ct);
        response.EnsureSuccessStatusCode();

        using var json = JsonDocument.Parse(body);
        var root = json.RootElement;

        var text = root.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString() ?? string.Empty;

        var usage = root.TryGetProperty("usage", out var usageElement)
            ? usageElement
            : default;

        var inputTokens = usage.ValueKind != JsonValueKind.Undefined && usage.TryGetProperty("prompt_tokens", out var prompt)
            ? prompt.GetInt32()
            : tokenEstimator.EstimateTokens(string.Join("\n", request.Messages.Select(x => x.Content)));

        var outputTokens = usage.ValueKind != JsonValueKind.Undefined && usage.TryGetProperty("completion_tokens", out var completion)
            ? completion.GetInt32()
            : tokenEstimator.EstimateTokens(text);

        return new ProviderChatResult
        {
            ResponseText = text,
            InputTokens = inputTokens,
            OutputTokens = outputTokens,
            RawPayloadJson = body
        };
    }

    public async IAsyncEnumerable<ProviderStreamChunk> StreamAsync(ProviderChatRequest request, [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct)
    {
        var result = await CompleteAsync(request, ct);

        foreach (var piece in result.ResponseText.Split(' '))
        {
            ct.ThrowIfCancellationRequested();
            yield return new ProviderStreamChunk(piece + " ");
        }
    }
}
