using System.Text.Json;

namespace Contracts.Events;

/// <summary>
/// Safe reads of event payload strings. A JSON escape with an unpaired surrogate (<c>"\ud800"</c>) cannot be
/// transcoded and makes <see cref="JsonElement.GetString"/> throw; such a value is bad input, read as null.
/// </summary>
public static class JsonElementExtensions
{
    /// <summary>String value of the element, or null when it is not a string or holds an unpaired surrogate.</summary>
    public static string? GetSafeString(this JsonElement value)
    {
        if (value.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        try
        {
            return value.GetString();
        }
        catch (InvalidOperationException)
        {
            return null;
        }
    }

    /// <summary>
    /// String property of an object (see <see cref="GetSafeString"/>), or null when the element is not an object
    /// or has no such property.
    /// </summary>
    public static string? GetSafeString(this JsonElement value, string property) =>
        value.ValueKind == JsonValueKind.Object && value.TryGetProperty(property, out var element)
            ? element.GetSafeString()
            : null;
}
