namespace Hyoka.Application.Abstractions;

public interface IDocumentExtractor
{
    Task<string?> TryExtractTextAsync(string fileName, string mimeType, Stream content, CancellationToken ct);
}
