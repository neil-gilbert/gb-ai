using System.Text;
using DocumentFormat.OpenXml.Packaging;
using Hyoka.Application.Abstractions;
using UglyToad.PdfPig;

namespace Hyoka.Infrastructure.Services;

public sealed class DocumentExtractor : IDocumentExtractor
{
    public async Task<string?> TryExtractTextAsync(string fileName, string mimeType, Stream content, CancellationToken ct)
    {
        _ = ct;

        var extension = Path.GetExtension(fileName).ToLowerInvariant();

        if (mimeType == "text/plain" || extension == ".txt" || mimeType == "text/markdown" || extension == ".md")
        {
            using var reader = new StreamReader(content, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, leaveOpen: true);
            content.Position = 0;
            return await reader.ReadToEndAsync();
        }

        if (mimeType == "application/pdf" || extension == ".pdf")
        {
            content.Position = 0;
            using var doc = PdfDocument.Open(content);
            var sb = new StringBuilder();
            foreach (var page in doc.GetPages())
            {
                sb.AppendLine(page.Text);
            }

            return sb.ToString();
        }

        if (mimeType == "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || extension == ".docx")
        {
            content.Position = 0;
            using var memory = new MemoryStream();
            await content.CopyToAsync(memory, ct);
            memory.Position = 0;

            using var wordDoc = WordprocessingDocument.Open(memory, false);
            return wordDoc.MainDocumentPart?.Document?.Body?.InnerText;
        }

        return null;
    }
}
