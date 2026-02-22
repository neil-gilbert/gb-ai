using Hyoka.Domain.Entities;

namespace Hyoka.Application.Abstractions;

public interface IAttachmentService
{
    Task<Attachment> CreatePresignedUploadAsync(Guid userId, string fileName, string mimeType, long sizeBytes, CancellationToken ct);
    Task UploadAsync(Guid userId, Guid attachmentId, Stream content, string contentType, CancellationToken ct);
    Task<Attachment> FinalizeAsync(Guid userId, Guid attachmentId, CancellationToken ct);
    Task<IReadOnlyList<Attachment>> ResolveAttachmentsAsync(Guid userId, IReadOnlyList<Guid> attachmentIds, CancellationToken ct);
}
