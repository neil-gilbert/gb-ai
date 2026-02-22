using Hyoka.Application.Abstractions;

namespace Hyoka.Application.Services;

public sealed class TokenEstimator : ITokenEstimator
{
    public int EstimateTokens(string content)
    {
        if (string.IsNullOrWhiteSpace(content))
        {
            return 0;
        }

        // Coarse approximation for fallback when provider usage metadata is unavailable.
        return Math.Max(1, content.Length / 4);
    }
}
