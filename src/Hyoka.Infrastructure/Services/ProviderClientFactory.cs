using Hyoka.Application.Abstractions;
using Hyoka.Domain.Enums;
using Hyoka.Infrastructure.Services.Providers;

namespace Hyoka.Infrastructure.Services;

public sealed class ProviderClientFactory(
    OpenAiProviderClient openAi,
    OpenRouterProviderClient openRouter,
    AnthropicProviderClient anthropic,
    MockProviderClient mock) : IProviderClientFactory
{
    public IModelProviderClient GetClient(string provider) => provider.ToLowerInvariant() switch
    {
        ProviderKind.OpenAi => openAi,
        ProviderKind.OpenRouter => openRouter,
        ProviderKind.Anthropic => anthropic,
        _ => mock
    };
}
