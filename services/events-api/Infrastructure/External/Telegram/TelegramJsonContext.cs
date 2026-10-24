using System.Text.Json.Serialization;

namespace EventsApi.Infrastructure.External.Telegram;

[JsonSerializable(typeof(TelegramSendMessageRequest))]
internal sealed partial class TelegramJsonContext : JsonSerializerContext;
