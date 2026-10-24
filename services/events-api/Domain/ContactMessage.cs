using System.Text.RegularExpressions;

namespace EventsApi.Domain;

/// <summary>
/// Message in a bottle (FR17): name, reply address (email or Telegram @username) and text. Never stored, logged
/// or put into spans — only forwarded to the owner.
/// </summary>
public sealed partial record ContactMessage(string Name, string ReplyTo, string Text)
{
    public const int NameMaxLength = 80;
    public const int ReplyToMaxLength = 120;
    public const int TextMaxLength = 2000;

    /// <summary>Trims the fields; missing ones become empty (and fail <see cref="Validate"/>).</summary>
    public static ContactMessage From(string? name, string? replyTo, string? text) =>
        new(name?.Trim() ?? "", replyTo?.Trim() ?? "", text?.Trim() ?? "");

    /// <returns>Errors by field (<c>name</c>, <c>replyTo</c>, <c>text</c>); empty = valid.</returns>
    public Dictionary<string, string[]> Validate()
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        RequireLength(errors, "name", Name, NameMaxLength);
        RequireLength(errors, "replyTo", ReplyTo, ReplyToMaxLength);
        RequireLength(errors, "text", Text, TextMaxLength);

        if (!errors.ContainsKey("replyTo") && !Email().IsMatch(ReplyTo) && !TelegramUsername().IsMatch(ReplyTo))
        {
            errors["replyTo"] = ["Must be an email address or a Telegram @username."];
        }

        return errors;
    }

    private static void RequireLength(Dictionary<string, string[]> errors, string field, string value, int maxLength)
    {
        if (value.Length == 0)
        {
            errors[field] = ["Required."];
        }
        else if (value.Length > maxLength)
        {
            errors[field] = [$"Must be at most {maxLength} characters."];
        }
    }

    // Простая проверка формата: что-то@домен.зона без пробелов
    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s.]+$")]
    private static partial Regex Email();

    // Ник Telegram: 5–32 символа латиницы, цифр и подчёркиваний
    [GeneratedRegex(@"^@[A-Za-z0-9_]{5,32}$")]
    private static partial Regex TelegramUsername();
}
