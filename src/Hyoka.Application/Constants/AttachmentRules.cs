namespace Hyoka.Application.Constants;

public static class AttachmentRules
{
    public const long MaxBytes = 1 * 1024 * 1024;

    public static readonly HashSet<string> AllowedMimeTypes =
    [
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/gif",
        "application/pdf",
        "text/plain",
        "text/markdown",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];

    public static readonly HashSet<string> AllowedExtensions =
    [
        ".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf", ".txt", ".md", ".docx"
    ];
}
