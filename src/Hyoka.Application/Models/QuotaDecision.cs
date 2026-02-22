namespace Hyoka.Application.Models;

public sealed class QuotaDecision
{
    public bool Allowed { get; init; }
    public string? Reason { get; init; }

    public static QuotaDecision Permit() => new() { Allowed = true };
    public static QuotaDecision Deny(string reason) => new() { Allowed = false, Reason = reason };
}
