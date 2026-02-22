namespace Hyoka.Infrastructure.Options;

public sealed class StripeOptions
{
    public const string SectionName = "Stripe";

    public string SecretKey { get; set; } = string.Empty;
    public string WebhookSecret { get; set; } = string.Empty;
    public string SuccessUrl { get; set; } = "http://localhost:3000/settings/billing?result=success";
    public string CancelUrl { get; set; } = "http://localhost:3000/settings/billing?result=cancel";
}
