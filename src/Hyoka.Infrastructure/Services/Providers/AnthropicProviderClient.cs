using System.Net.Http.Json;
using System.Text.Json;
using Hyoka.Application.Abstractions;
using Hyoka.Application.Models;
using Hyoka.Infrastructure.Options;
using Microsoft.Extensions.Options;

namespace Hyoka.Infrastructure.Services.Providers;

public sealed class AnthropicProviderClient(
    IHttpClientFactory httpClientFactory,
    IOptions<ProviderRuntimeOptions> options,
    ITokenEstimator tokenEstimator) : IModelProviderClient
{
    public async Task<ProviderChatResult> CompleteAsync(ProviderChatRequest request, CancellationToken ct)
    {
        var endpoint = options.Value.Anthropic;
        if (string.IsNullOrWhiteSpace(endpoint.ApiKey))
        {
            throw new InvalidOperationException("Anthropic API key is not configured.");
        }

        using var http = httpClientFactory.CreateClient();
        http.Timeout = TimeSpan.FromSeconds(Math.Max(10, endpoint.TimeoutSeconds));
        http.DefaultRequestHeaders.Add("x-api-key", endpoint.ApiKey);
        http.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");

        var url = endpoint.BaseUrl.TrimEnd('/') + "/v1/messages";
        var payload = new
        {
            model = request.ProviderModelId,
            max_tokens = 2048,
            system = request.SystemPrompt,
            messages = ProviderMessageProjector.ToAnthropicMessages(request)
        };

        using var response = await http.PostAsJsonAsync(url, payload, cancellationToken: ct);
        var body = await response.Content.ReadAsStringAsync(ct);
        response.EnsureSuccessStatusCode();

        using var json = JsonDocument.Parse(body);
        var root = json.RootElement;

        var text = string.Empty;
        if (root.TryGetProperty("content", out var contentElement) && contentElement.ValueKind == JsonValueKind.Array)
        {
            var textElement = contentElement.EnumerateArray().FirstOrDefault();
            if (textElement.ValueKind == JsonValueKind.Object && textElement.TryGetProperty("text", out var t))
            {
                text = t.GetString() ?? string.Empty;
            }
        }

        var usage = root.TryGetProperty("usage", out var usageElement)
            ? usageElement
            : default;

        var inputTokens = usage.ValueKind != JsonValueKind.Undefined && usage.TryGetProperty("input_tokens", out var input)
            ? input.GetInt32()
            : tokenEstimator.EstimateTokens(string.Join("\n", request.Messages.Select(x => x.Content)));

        var outputTokens = usage.ValueKind != JsonValueKind.Undefined && usage.TryGetProperty("output_tokens", out var output)
            ? output.GetInt32()
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
