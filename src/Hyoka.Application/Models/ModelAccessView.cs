namespace Hyoka.Application.Models;

public sealed class ModelAccessView
{
    public required string ModelKey { get; init; }
    public required string DisplayName { get; init; }
    public required string Provider { get; init; }
    public required decimal InputWeight { get; init; }
    public required decimal OutputWeight { get; init; }
}
