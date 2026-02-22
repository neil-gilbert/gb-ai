using Hyoka.Application.Models;

namespace Hyoka.Infrastructure.Services.Providers;

internal static class ProviderMessageProjector
{
    public static IReadOnlyList<object> ToOpenAiMessages(ProviderChatRequest request)
    {
        var messages = new List<object>();

        if (!string.IsNullOrWhiteSpace(request.SystemPrompt))
        {
            messages.Add(new { role = "system", content = request.SystemPrompt });
        }

        messages.AddRange(request.Messages.Select(m => new { role = NormalizeRole(m.Role), content = m.Content }));

        if (request.Attachments.Count > 0)
        {
            var attachmentContext = string.Join("\n\n", request.Attachments.Select(ToAttachmentPrompt));
            messages.Add(new { role = "user", content = "Attachment context:\n" + attachmentContext });
        }

        return messages;
    }

    public static IReadOnlyList<object> ToAnthropicMessages(ProviderChatRequest request)
    {
        var messages = new List<object>();
        messages.AddRange(request.Messages.Select(m => new { role = NormalizeRoleForAnthropic(m.Role), content = m.Content }));

        if (request.Attachments.Count > 0)
        {
            var attachmentContext = string.Join("\n\n", request.Attachments.Select(ToAttachmentPrompt));
            messages.Add(new { role = "user", content = "Attachment context:\n" + attachmentContext });
        }

        return messages;
    }

    private static string ToAttachmentPrompt(ProviderAttachment attachment)
    {
        if (!string.IsNullOrWhiteSpace(attachment.ExtractedText))
        {
            return $"File: {attachment.FileName} ({attachment.MimeType})\n{attachment.ExtractedText}";
        }

        return $"File: {attachment.FileName} ({attachment.MimeType})";
    }

    private static string NormalizeRole(string role) => role.ToLowerInvariant() switch
    {
        "assistant" => "assistant",
        "system" => "system",
        _ => "user"
    };

    private static string NormalizeRoleForAnthropic(string role) => role.ToLowerInvariant() switch
    {
        "assistant" => "assistant",
        _ => "user"
    };
}
