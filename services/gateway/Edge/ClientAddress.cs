namespace Gateway.Edge;

// Адрес посетителя после ForwardedHeaders: X-Forwarded-For учитывается только от доверенного прокси.
// Используется только как ключ партиции лимитера в памяти и не логируется.
internal static class ClientAddress
{
    public static string PartitionKey(HttpContext context)
    {
        var address = context.Connection.RemoteIpAddress;
        if (address is null)
        {
            return "unknown";
        }

        return (address.IsIPv4MappedToIPv6 ? address.MapToIPv4() : address).ToString();
    }
}
