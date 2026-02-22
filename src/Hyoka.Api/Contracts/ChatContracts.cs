namespace Hyoka.Api.Contracts;

public sealed class CreateChatRequest
{
    public string? Title { get; init; }
}

public sealed class SendMessageRequest
{
    public required string ModelKey { get; init; }
    public required string Text { get; init; }
    public IReadOnlyList<Guid> AttachmentIds { get; init; } = [];
}

public sealed class PresignAttachmentRequest
{
    public required string FileName { get; init; }
    public required string MimeType { get; init; }
    public required long SizeBytes { get; init; }
}

public sealed class CheckoutRequest
{
    public required string PlanName { get; init; }
    public string? SuccessUrl { get; init; }
    public string? CancelUrl { get; init; }
}

public sealed class PortalRequest
{
    public string? ReturnUrl { get; init; }
}

public sealed class UpdatePlanRequest
{
    public required string Name { get; init; }
    public required string StripePriceId { get; init; }
    public required bool IsActive { get; init; }
    public required int RequestsPerMinute { get; init; }
    public required int RequestsPerDay { get; init; }
    public required int RequestsPerMonth { get; init; }
    public required decimal CreditsPerDay { get; init; }
    public required decimal CreditsPerMonth { get; init; }
    public required decimal MonthlyPriceUsd { get; init; }
}

public sealed class UpdateModelRequest
{
    public required string DisplayName { get; init; }
    public required string Provider { get; init; }
    public string? ProviderModelId { get; init; }
    public string? FallbackModelKey { get; init; }
    public required decimal InputWeight { get; init; }
    public required decimal OutputWeight { get; init; }
    public required bool Enabled { get; init; }
    public required string PlanAccessCsv { get; init; }
}
