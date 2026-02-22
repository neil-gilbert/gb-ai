namespace Hyoka.Infrastructure.Options;

public sealed class ProviderRuntimeOptions
{
    public const string SectionName = "Providers";

    public ProviderEndpointOptions OpenAI { get; set; } = new();
    public ProviderEndpointOptions Anthropic { get; set; } = new();
    public ProviderEndpointOptions OpenRouter { get; set; } = new();
}

public sealed class ProviderEndpointOptions
{
    public string BaseUrl { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public int TimeoutSeconds { get; set; } = 120;
}
