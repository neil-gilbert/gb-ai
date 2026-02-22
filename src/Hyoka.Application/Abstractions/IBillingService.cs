namespace Hyoka.Application.Abstractions;

public interface IBillingService
{
    Task<string> CreateCheckoutSessionAsync(Guid userId, string planName, string successUrl, string cancelUrl, CancellationToken ct);
    Task<string> CreatePortalSessionAsync(Guid userId, string returnUrl, CancellationToken ct);
    Task HandleWebhookAsync(string payload, string signature, CancellationToken ct);
}
