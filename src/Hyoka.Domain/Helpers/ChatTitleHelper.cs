namespace Hyoka.Domain.Helpers;

public static class ChatTitleHelper
{
    public static string FromFirstPrompt(string prompt)
    {
        if (string.IsNullOrWhiteSpace(prompt))
        {
            return "New chat";
        }

        var words = prompt
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Take(8)
            .ToArray();

        var candidate = string.Join(' ', words).Trim();
        if (candidate.Length > 72)
        {
            candidate = candidate[..72].TrimEnd();
        }

        return string.IsNullOrWhiteSpace(candidate) ? "New chat" : candidate;
    }
}
