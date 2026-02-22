using System.Text;
using Hyoka.Application.Abstractions;
using Hyoka.Application.Constants;
using Hyoka.Domain.Entities;
using Hyoka.Domain.Enums;
using Hyoka.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Hyoka.Infrastructure.Services;

public sealed class AttachmentService(
    HyokaDbContext db,
    IObjectStorage objectStorage,
    IDocumentExtractor documentExtractor,
    IClock clock) : IAttachmentService
{
    public async Task<Attachment> CreatePresignedUploadAsync(
        Guid userId,
        string fileName,
        string mimeType,
        long sizeBytes,
        CancellationToken ct)
    {
        ValidateInput(fileName, mimeType, sizeBytes);

        var storageKey = $"users/{userId}/attachments/{Guid.NewGuid():N}/{SanitizeFileName(fileName)}";

        var attachment = new Attachment
        {
            UserId = userId,
            OriginalFileName = fileName,
            MimeType = mimeType,
            SizeBytes = sizeBytes,
            StorageKey = storageKey,
            Status = AttachmentStatus.Pending,
            CreatedAtUtc = clock.UtcNow
        };

        db.Attachments.Add(attachment);
        await db.SaveChangesAsync(ct);

        return attachment;
    }

    public async Task UploadAsync(Guid userId, Guid attachmentId, Stream content, string contentType, CancellationToken ct)
    {
        var attachment = await db.Attachments.FirstOrDefaultAsync(
            x => x.Id == attachmentId && x.UserId == userId,
            ct) ?? throw new InvalidOperationException("Attachment not found.");

        if (attachment.Status != AttachmentStatus.Pending)
        {
            throw new InvalidOperationException("Attachment is not in a pending state.");
        }

        if (!string.Equals(attachment.MimeType, contentType, StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrWhiteSpace(contentType))
        {
            throw new InvalidOperationException("Uploaded content type does not match presigned metadata.");
        }

        await objectStorage.UploadAsync(attachment.StorageKey, content, attachment.MimeType, ct);
        attachment.Status = AttachmentStatus.Uploaded;
        await db.SaveChangesAsync(ct);
    }

    public async Task<Attachment> FinalizeAsync(Guid userId, Guid attachmentId, CancellationToken ct)
    {
        var attachment = await db.Attachments.FirstOrDefaultAsync(
            x => x.Id == attachmentId && x.UserId == userId,
            ct) ?? throw new InvalidOperationException("Attachment not found.");

        if (attachment.Status != AttachmentStatus.Uploaded)
        {
            throw new InvalidOperationException("Attachment is not uploaded yet.");
        }

        var size = await objectStorage.GetSizeAsync(attachment.StorageKey, ct);
        if (!size.HasValue)
        {
            attachment.Status = AttachmentStatus.Failed;
            await db.SaveChangesAsync(ct);
            throw new InvalidOperationException("Uploaded object was not found in storage.");
        }

        if (size.Value > AttachmentRules.MaxBytes)
        {
            attachment.Status = AttachmentStatus.Failed;
            await db.SaveChangesAsync(ct);
            throw new InvalidOperationException("File exceeds the 1MB limit.");
        }

        attachment.SizeBytes = size.Value;

        if (IsDocument(attachment.MimeType, attachment.OriginalFileName))
        {
            using var stream = await objectStorage.DownloadAsync(attachment.StorageKey, ct)
                ?? throw new InvalidOperationException("Attachment stream unavailable.");

            attachment.ExtractedText = await documentExtractor.TryExtractTextAsync(
                attachment.OriginalFileName,
                attachment.MimeType,
                stream,
                ct);

            if (string.IsNullOrWhiteSpace(attachment.ExtractedText))
            {
                attachment.Status = AttachmentStatus.Failed;
                await db.SaveChangesAsync(ct);
                throw new InvalidOperationException("Document extraction failed for the uploaded file.");
            }

            if (attachment.ExtractedText.Length > 12000)
            {
                attachment.ExtractedText = attachment.ExtractedText[..12000];
            }
        }

        attachment.Status = AttachmentStatus.Ready;
        await db.SaveChangesAsync(ct);
        return attachment;
    }

    public async Task<IReadOnlyList<Attachment>> ResolveAttachmentsAsync(Guid userId, IReadOnlyList<Guid> attachmentIds, CancellationToken ct)
    {
        if (attachmentIds.Count == 0)
        {
            return [];
        }

        var results = await db.Attachments
            .Where(x => x.UserId == userId && attachmentIds.Contains(x.Id) && x.Status == AttachmentStatus.Ready)
            .ToListAsync(ct);

        if (results.Count != attachmentIds.Count)
        {
            throw new InvalidOperationException("One or more attachments are invalid or not ready.");
        }

        return results;
    }

    private static void ValidateInput(string fileName, string mimeType, long sizeBytes)
    {
        if (string.IsNullOrWhiteSpace(fileName))
        {
            throw new InvalidOperationException("File name is required.");
        }

        var extension = Path.GetExtension(fileName);
        if (!AttachmentRules.AllowedExtensions.Contains(extension, StringComparer.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Unsupported file extension.");
        }

        if (!AttachmentRules.AllowedMimeTypes.Contains(mimeType))
        {
            throw new InvalidOperationException("Unsupported MIME type.");
        }

        if (sizeBytes <= 0 || sizeBytes > AttachmentRules.MaxBytes)
        {
            throw new InvalidOperationException("File size must be between 1 byte and 1MB.");
        }
    }

    private static bool IsDocument(string mimeType, string fileName)
    {
        if (mimeType is "application/pdf" or "text/plain" or "text/markdown" or "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        {
            return true;
        }

        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        return ext is ".pdf" or ".txt" or ".md" or ".docx";
    }

    private static string SanitizeFileName(string fileName)
    {
        var sb = new StringBuilder(fileName.Length);
        foreach (var c in fileName)
        {
            if (char.IsLetterOrDigit(c) || c is '.' or '-' or '_')
            {
                sb.Append(c);
            }
            else
            {
                sb.Append('_');
            }
        }

        return sb.ToString();
    }
}
