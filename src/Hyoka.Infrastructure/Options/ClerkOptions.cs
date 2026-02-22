namespace Hyoka.Infrastructure.Options;

public sealed class ClerkOptions
{
    public const string SectionName = "Clerk";

    public string Issuer { get; set; } = string.Empty;
    public string Audience { get; set; } = string.Empty;
}
