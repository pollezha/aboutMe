using Testcontainers.Kafka;
using Xunit;

namespace EventsApi.Tests;

// Один контейнер Kafka (KRaft) на класс тестов; без Docker падает с понятным сообщением за ≤ 90 с.
public abstract class KafkaContainerFixture : IAsyncLifetime
{
    private const string Image = "apache/kafka:4.1.1";
    private static readonly TimeSpan StartTimeout = TimeSpan.FromSeconds(90);

    private readonly KafkaContainer _container = new KafkaBuilder(Image).Build();

    public string BootstrapServers => _container.GetBootstrapAddress();

    public async ValueTask InitializeAsync()
    {
        using var cts = new CancellationTokenSource(StartTimeout);
        try
        {
            await _container.StartAsync(cts.Token);
        }
        catch (Exception ex) when (ex is not OutOfMemoryException)
        {
            throw new InvalidOperationException(
                $"Kafka ({Image}) не запустилась за {StartTimeout.TotalSeconds:0} с. "
                + "Интеграционным тестам (Category=Integration) нужен запущенный Docker: проверьте `docker info`.",
                ex);
        }

        await OnStartedAsync();
    }

    public async ValueTask DisposeAsync()
    {
        await _container.DisposeAsync();
        GC.SuppressFinalize(this);
    }

    protected virtual Task OnStartedAsync() => Task.CompletedTask;
}

// Пустой брокер: топика ещё нет, его должен создать сам events-api.
public sealed class EmptyKafkaFixture : KafkaContainerFixture;
