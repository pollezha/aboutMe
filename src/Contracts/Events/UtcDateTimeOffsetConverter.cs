using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Contracts.Events;

/// <summary>
/// Writes timestamps in UTC with a <c>Z</c> suffix (<c>2026-10-20T12:00:00Z</c>) as in design §5.4;
/// the default converter would write <c>+00:00</c>.
/// </summary>
public sealed class UtcDateTimeOffsetConverter : JsonConverter<DateTimeOffset>
{
    private const string Format = "yyyy-MM-dd'T'HH:mm:ss.FFFFFFF'Z'";

    public override DateTimeOffset Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        reader.GetDateTimeOffset().ToUniversalTime();

    public override void Write(Utf8JsonWriter writer, DateTimeOffset value, JsonSerializerOptions options)
    {
        ArgumentNullException.ThrowIfNull(writer);
        writer.WriteStringValue(value.UtcDateTime.ToString(Format, CultureInfo.InvariantCulture));
    }
}
