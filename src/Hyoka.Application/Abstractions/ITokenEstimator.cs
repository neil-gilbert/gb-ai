namespace Hyoka.Application.Abstractions;

public interface ITokenEstimator
{
    int EstimateTokens(string content);
}
