namespace Hyoka.Application.Abstractions;

public interface IObjectStorage
{
    Task UploadAsync(string key, Stream content, string contentType, CancellationToken ct);
    Task<Stream?> DownloadAsync(string key, CancellationToken ct);
    Task<long?> GetSizeAsync(string key, CancellationToken ct);
}
