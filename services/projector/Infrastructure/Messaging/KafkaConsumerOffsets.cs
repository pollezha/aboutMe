using Confluent.Kafka;
using Confluent.Kafka.Admin;
using Projector.Application.Abstractions;

namespace Projector.Infrastructure.Messaging;

/// <summary>
/// Сброс офсетов через удаление consumer group вместе с её офсетами: Kafka разрешает это только для группы без
/// участников, а новая группа начнёт с <c>auto.offset.reset=earliest</c>.
/// </summary>
public sealed class KafkaConsumerOffsets(string bootstrapServers) : IConsumerOffsets
{
    public async Task<bool> ResetToBeginningAsync(string consumerGroup, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrEmpty(consumerGroup);
        // Пустая строка подключения "kafka" — ошибка конфигурации, а не «сбрасывать нечего»
        ArgumentException.ThrowIfNullOrEmpty(bootstrapServers);

        using var admin = new AdminClientBuilder(new AdminClientConfig { BootstrapServers = bootstrapServers }).Build();
        try
        {
            await admin.DeleteGroupsAsync([consumerGroup]);
            return true;
        }
        catch (DeleteGroupsException ex) when (ex.Results.TrueForAll(r => r.Error.Code == ErrorCode.GroupIdNotFound))
        {
            // Группа ещё ничего не коммитила — сбрасывать нечего
            return true;
        }
        catch (DeleteGroupsException ex) when (ex.Results.Exists(r => r.Error.Code == ErrorCode.NonEmptyGroup))
        {
            return false;
        }
    }
}
