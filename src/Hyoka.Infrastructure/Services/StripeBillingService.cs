using Hyoka.Application.Abstractions;
using Hyoka.Infrastructure.Data;
using Hyoka.Infrastructure.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Stripe;
using Stripe.Checkout;

namespace Hyoka.Infrastructure.Services;

public sealed class StripeBillingService(
    IOptions<StripeOptions> options,
    HyokaDbContext db,
    IClock clock,
    ILogger<StripeBillingService> logger) : IBillingService
{
    private readonly StripeOptions _options = options.Value;

    public async Task<string> CreateCheckoutSessionAsync(Guid userId, string planName, string successUrl, string cancelUrl, CancellationToken ct)
    {
        EnsureConfigured();

        var user = await db.Users.FirstOrDefaultAsync(x => x.Id == userId, ct)
            ?? throw new InvalidOperationException("User not found.");

        var plan = await db.Plans.FirstOrDefaultAsync(x => x.Name == planName && x.IsActive, ct)
            ?? throw new InvalidOperationException("Plan not found.");

        var service = new SessionService();
        var session = await service.CreateAsync(new SessionCreateOptions
        {
            Mode = "subscription",
            SuccessUrl = string.IsNullOrWhiteSpace(successUrl) ? _options.SuccessUrl : successUrl,
            CancelUrl = string.IsNullOrWhiteSpace(cancelUrl) ? _options.CancelUrl : cancelUrl,
            ClientReferenceId = user.Id.ToString(),
            CustomerEmail = user.Email,
            LineItems =
            [
                new SessionLineItemOptions
                {
                    Price = plan.StripePriceId,
                    Quantity = 1
                }
            ],
            Metadata = new Dictionary<string, string>
            {
                ["planName"] = plan.Name,
                ["userId"] = user.Id.ToString()
            }
        }, cancellationToken: ct);

        return session.Url ?? throw new InvalidOperationException("Stripe did not return a checkout URL.");
    }

    public async Task<string> CreatePortalSessionAsync(Guid userId, string returnUrl, CancellationToken ct)
    {
        EnsureConfigured();

        var subscription = await db.Subscriptions
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.CreatedAtUtc)
            .FirstOrDefaultAsync(ct)
            ?? throw new InvalidOperationException("No Stripe subscription found for this user.");

        var portal = new Stripe.BillingPortal.SessionService();
        var session = await portal.CreateAsync(new Stripe.BillingPortal.SessionCreateOptions
        {
            Customer = subscription.StripeCustomerId,
            ReturnUrl = string.IsNullOrWhiteSpace(returnUrl) ? _options.SuccessUrl : returnUrl
        }, cancellationToken: ct);

        return session.Url;
    }

    public async Task HandleWebhookAsync(string payload, string signature, CancellationToken ct)
    {
        EnsureConfigured();

        Event stripeEvent;
        if (!string.IsNullOrWhiteSpace(_options.WebhookSecret))
        {
            stripeEvent = EventUtility.ConstructEvent(payload, signature, _options.WebhookSecret);
        }
        else
        {
            stripeEvent = EventUtility.ParseEvent(payload);
        }

        switch (stripeEvent.Type)
        {
            case "checkout.session.completed":
                await HandleCheckoutCompletedAsync(stripeEvent, ct);
                break;
            case "customer.subscription.updated":
            case "customer.subscription.created":
            case "customer.subscription.deleted":
                await HandleSubscriptionChangedAsync(stripeEvent, ct);
                break;
            default:
                logger.LogDebug("Ignoring Stripe event type {EventType}", stripeEvent.Type);
                break;
        }
    }

    private async Task HandleCheckoutCompletedAsync(Event stripeEvent, CancellationToken ct)
    {
        var session = stripeEvent.Data.Object as Session;
        if (session is null)
        {
            return;
        }

        var userIdRaw = session.Metadata?.GetValueOrDefault("userId") ?? session.ClientReferenceId;
        var planName = session.Metadata?.GetValueOrDefault("planName");

        if (!Guid.TryParse(userIdRaw, out var userId))
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(planName))
        {
            return;
        }

        var plan = await db.Plans.FirstOrDefaultAsync(x => x.Name == planName, ct);
        if (plan is null)
        {
            return;
        }

        var existing = await db.Subscriptions.FirstOrDefaultAsync(
            x => x.StripeSubscriptionId == session.SubscriptionId,
            ct);

        if (existing is null)
        {
            db.Subscriptions.Add(new Domain.Entities.Subscription
            {
                UserId = userId,
                PlanId = plan.Id,
                StripeCustomerId = session.CustomerId ?? string.Empty,
                StripeSubscriptionId = session.SubscriptionId ?? string.Empty,
                Status = "active",
                PeriodStartUtc = clock.UtcNow,
                PeriodEndUtc = clock.UtcNow.AddMonths(1),
                CreatedAtUtc = clock.UtcNow
            });
        }

        await db.SaveChangesAsync(ct);
    }

    private async Task HandleSubscriptionChangedAsync(Event stripeEvent, CancellationToken ct)
    {
        var sub = stripeEvent.Data.Object as Stripe.Subscription;
        if (sub is null)
        {
            return;
        }

        var existing = await db.Subscriptions.FirstOrDefaultAsync(x => x.StripeSubscriptionId == sub.Id, ct);
        if (existing is null)
        {
            return;
        }

        existing.Status = sub.Status ?? existing.Status;

        if (sub.CurrentPeriodStart > DateTime.MinValue)
        {
            existing.PeriodStartUtc = sub.CurrentPeriodStart.ToUniversalTime();
        }

        if (sub.CurrentPeriodEnd > DateTime.MinValue)
        {
            existing.PeriodEndUtc = sub.CurrentPeriodEnd.ToUniversalTime();
        }

        await db.SaveChangesAsync(ct);
    }

    private void EnsureConfigured()
    {
        if (string.IsNullOrWhiteSpace(_options.SecretKey))
        {
            throw new InvalidOperationException("Stripe secret key is not configured.");
        }

        StripeConfiguration.ApiKey = _options.SecretKey;
    }
}
