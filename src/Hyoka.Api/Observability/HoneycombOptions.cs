namespace Hyoka.Api.Observability;

public sealed class HoneycombOptions
{
    public const string SectionName = "Observability:Honeycomb";

    public bool Enabled { get; set; } = true;
    public string Endpoint { get; set; } = "https://api.honeycomb.io";
    public string ApiKey { get; set; } = string.Empty;
    public string Dataset { get; set; } = string.Empty;
    public string ServiceName { get; set; } = "hyoka-api";
}
