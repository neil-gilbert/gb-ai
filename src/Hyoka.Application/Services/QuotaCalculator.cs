namespace Hyoka.Application.Services;

public static class QuotaCalculator
{
    public static decimal ComputeCredits(int inputTokens, int outputTokens, decimal inputWeight, decimal outputWeight)
    {
        if (inputTokens < 0)
        {
            inputTokens = 0;
        }

        if (outputTokens < 0)
        {
            outputTokens = 0;
        }

        return (inputTokens * inputWeight) + (outputTokens * outputWeight);
    }
}
