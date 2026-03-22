using Hyoka.Application.Models;

namespace Hyoka.Application.Abstractions;

public interface INewsWidgetService
{
    Task<NewsWidgetData> GetHeadlinesAsync(
        string locality,
        string principalSubdivision,
        string countryCode,
        bool refresh,
        CancellationToken ct);
}
