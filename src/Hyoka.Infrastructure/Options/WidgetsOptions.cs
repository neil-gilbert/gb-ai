namespace Hyoka.Infrastructure.Options;

public sealed class WidgetsOptions
{
    public const string SectionName = "Widgets";

    public WidgetNewsOptions News { get; set; } = new();
}

public sealed class WidgetNewsOptions
{
    public string BaseUrl { get; set; } = "https://gnews.io/api/v4";
    public string ApiKey { get; set; } = string.Empty;
    public int TimeoutSeconds { get; set; } = 30;
}
