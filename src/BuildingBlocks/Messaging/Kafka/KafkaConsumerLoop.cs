using System.Diagnostics;
using System.Diagnostics.Metrics;
using Confluent.Kafka;
using Microsoft.Extensions.Logging;

namespace BuildingBlocks.Messaging.Kafka;

/// <summary>
/// Общий цикл консьюмера (ADR-0002, ADR-0008): consume батча → десериализация → обработчик → коммит офсетов
/// только после успешного обработчика. Батч — до <see cref="KafkaConsumerLoopOptions.MaxBatchSize"/> сообщений
/// или <see cref="KafkaConsumerLoopOptions.BatchWindow"/> после первого из них. Ядовитое сообщение (десериализатор
/// вернул null или бросил) считается, пропускается, его офсет коммитится вместе с батчем (DLQ в MVP нет).
/// Ошибка обработчика не роняет цикл: батч повторяется с растущей паузой, офсет стоит на месте. Если ошибка
/// детерминированная (<see cref="KafkaConsumerLoopOptions.IsPoison"/>), батч из нескольких сообщений один раз
/// прогоняется поштучно: ядовитыми считаются и пропускаются только упавшие детерминированно; если так упали все —
/// это скорее системная ошибка (например, сломанная миграция), и батч повторяется как при транзиентной.
/// На каждое сообщение — спан <c>process</c>, продолжающий трейс продюсера.
/// </summary>
public sealed class KafkaConsumerLoop<TMessage>
    where TMessage : class
{
    private readonly IConsumer<string, string> _consumer;
    private readonly Func<ConsumeResult<string, string>, TMessage?> _deserialize;
    private readonly IKafkaMessageHandler<TMessage> _handler;
    private readonly KafkaConsumerLoopOptions _options;
    private readonly Counter<long> _poison;
    private readonly ILogger _logger;

    public KafkaConsumerLoop(
        IConsumer<string, string> consumer,
        Func<ConsumeResult<string, string>, TMessage?> deserialize,
        IKafkaMessageHandler<TMessage> handler,
        KafkaConsumerLoopOptions options,
        Meter meter,
        ILogger logger)
    {
        ArgumentNullException.ThrowIfNull(consumer);
        ArgumentNullException.ThrowIfNull(deserialize);
        ArgumentNullException.ThrowIfNull(handler);
        ArgumentNullException.ThrowIfNull(options);
        ArgumentNullException.ThrowIfNull(meter);
        ArgumentNullException.ThrowIfNull(logger);
        ArgumentOutOfRangeException.ThrowIfLessThan(options.MaxBatchSize, 1);

        _consumer = consumer;
        _deserialize = deserialize;
        _handler = handler;
        _options = options;
        _logger = logger;
        _poison = meter.CreateCounter<long>(
            options.PoisonCounterName, unit: "{message}", description: $"Messages of {options.Topic} that could not be deserialized or failed the handler deterministically and were skipped");
    }

    /// <summary>
    /// Подписывается на топик и крутится до отмены; на выходе закрывает консьюмер (выход из группы без ожидания
    /// session timeout). Consume блокирует поток — вызывать из фонового потока (<c>Task.Run</c>).
    /// </summary>
    public async Task RunAsync(CancellationToken stoppingToken)
    {
        _consumer.Subscribe(_options.Topic);
        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                var batch = ConsumeBatch(out var consumeFailed);
                if (batch.Count > 0)
                {
                    await HandleWithRetryAsync(batch, stoppingToken);
                    CommitOffsets(batch);
                }
                else if (consumeFailed)
                {
                    await Task.Delay(_options.FirstRetryDelay, stoppingToken);
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Остановка: незакоммиченный батч будет прочитан заново — обработчик идемпотентен
        }
        finally
        {
            CloseConsumer();
        }
    }

    private Batch ConsumeBatch(out bool consumeFailed)
    {
        consumeFailed = false;
        var batch = new Batch();
        var timeout = _options.BatchWindow;
        long? deadline = null;
        while (batch.Count < _options.MaxBatchSize)
        {
            if (deadline is { } end)
            {
                timeout = Stopwatch.GetElapsedTime(Stopwatch.GetTimestamp(), end);
                if (timeout <= TimeSpan.Zero)
                {
                    break;
                }
            }

            ConsumeResult<string, string>? result;
            try
            {
                result = _consumer.Consume(timeout);
            }
            catch (KafkaException ex)
            {
                // Нет топика, брокер недоступен и т. п.: librdkafka переподключается сам, повторим чуть позже
                KafkaConsumerLoopLog.ConsumeFailed(_logger, ex.Error.Code, ex.Error.Reason);
                consumeFailed = true;
                break;
            }

            if (result is null)
            {
                break;
            }

            if (result.IsPartitionEOF || result.Message is null)
            {
                continue;
            }

            // Окно добора батча отсчитывается от первого сообщения
            deadline ??= Stopwatch.GetTimestamp() + (long)(_options.BatchWindow.TotalSeconds * Stopwatch.Frequency);
            Accept(batch, result);
        }

        return batch;
    }

    private void Accept(Batch batch, ConsumeResult<string, string> result)
    {
        using (var activity = KafkaTracePropagation.StartProcessActivity(result))
        {
            if (activity is not null)
            {
                batch.Links.Add(new ActivityLink(activity.Context));
            }

            if (TryDeserialize(result) is { } message)
            {
                batch.Messages.Add(message);
                batch.MessageLinks.Add(activity is null ? [] : [new ActivityLink(activity.Context)]);
            }
            else
            {
                _poison.Add(1);
                activity?.SetStatus(ActivityStatusCode.Error, "poison message");
                // Тело не логируем: в нём может оказаться что угодно
                KafkaConsumerLoopLog.Poison(_logger, result.Topic, result.Partition.Value, result.Offset.Value);
            }
        }

        batch.Offsets[result.TopicPartition] = result.Offset + 1;
        batch.Count++;
    }

    private TMessage? TryDeserialize(ConsumeResult<string, string> result)
    {
        try
        {
            return _deserialize(result);
        }
#pragma warning disable CA1031 // любое исключение десериализатора = ядовитое сообщение, цикл не падает
        catch (Exception)
#pragma warning restore CA1031
        {
            return null;
        }
    }

    private async Task HandleWithRetryAsync(Batch batch, CancellationToken stoppingToken)
    {
        if (batch.Messages.Count == 0)
        {
            return;
        }

        var kafkaBatch = new KafkaBatch<TMessage>(batch.Messages, batch.Links);
        var delay = _options.FirstRetryDelay;
        for (var attempt = 1; ; attempt++)
        {
            var error = await TryHandleAsync(kafkaBatch, stoppingToken);
            if (error is not null && IsPoison(error))
            {
                if (batch.Messages.Count == 1)
                {
                    SkipPoison(batch, error, 1);
                    return;
                }

                error = await HandleOneByOneAsync(batch, stoppingToken);
            }

            if (error is null)
            {
                return;
            }

            KafkaConsumerLoopLog.HandlerFailed(_logger, error, batch.Messages.Count, attempt, delay.TotalSeconds);
            await Task.Delay(delay, stoppingToken);
            delay = TimeSpan.FromTicks(Math.Min(delay.Ticks * 2, _options.MaxRetryDelay.Ticks));
        }
    }

    /// <summary>Ошибка обработчика или null при успехе; отмена при остановке пробрасывается.</summary>
    private async Task<Exception?> TryHandleAsync(KafkaBatch<TMessage> kafkaBatch, CancellationToken stoppingToken)
    {
        try
        {
            await _handler.HandleAsync(kafkaBatch, stoppingToken);
            return null;
        }
#pragma warning disable CA1031 // любая ошибка обработчика: офсет не коммитим, решает вызывающий (скип или повтор)
        catch (Exception ex) when (ex is not OperationCanceledException || !stoppingToken.IsCancellationRequested)
#pragma warning restore CA1031
        {
            return ex;
        }
    }

    private bool IsPoison(Exception exception) => _options.IsPoison is { } isPoison && isPoison(exception);

    /// <summary>
    /// Поштучный прогон батча, упавшего детерминированно: ядовитые — только упавшие детерминированно сообщения.
    /// Возвращает ошибку, если батч надо повторить целиком: транзиентная ошибка или детерминированно упали все
    /// сообщения (вероятно, системная причина); повтор безопасен — обработчик идемпотентен.
    /// </summary>
    private async Task<Exception?> HandleOneByOneAsync(Batch batch, CancellationToken stoppingToken)
    {
        var poisoned = 0;
        Exception? firstPoison = null;
        for (var i = 0; i < batch.Messages.Count; i++)
        {
            var single = new KafkaBatch<TMessage>([batch.Messages[i]], batch.MessageLinks[i]);
            if (await TryHandleAsync(single, stoppingToken) is not { } error)
            {
                continue;
            }

            if (!IsPoison(error))
            {
                return error;
            }

            poisoned++;
            firstPoison ??= error;
        }

        if (poisoned == batch.Messages.Count)
        {
            return firstPoison;
        }

        if (firstPoison is not null)
        {
            SkipPoison(batch, firstPoison, poisoned);
        }

        return null;
    }

    /// <summary>
    /// Детерминированная ошибка: повтор не поможет, <paramref name="count"/> сообщений уходят в ядовитые, офсет
    /// коммитит <see cref="RunAsync"/>. Тело не логируем — только партиции и офсеты.
    /// </summary>
    private void SkipPoison(Batch batch, Exception exception, int count)
    {
        _poison.Add(count);
        foreach (var (partition, next) in batch.Offsets)
        {
            KafkaConsumerLoopLog.PoisonBatch(
                _logger, exception.GetType().Name, count, partition.Topic, partition.Partition.Value, next.Value - 1);
        }
    }

    private void CommitOffsets(Batch batch)
    {
        if (!_options.CommitOffsets)
        {
            return;
        }

        try
        {
            _consumer.Commit(batch.Offsets.Select(o => new TopicPartitionOffset(o.Key, o.Value)));
        }
        catch (KafkaException ex)
        {
            // Например, ребалансировка: батч придёт ещё раз, идемпотентный обработчик отсечёт повтор
            KafkaConsumerLoopLog.CommitFailed(_logger, ex.Error.Code, ex.Error.Reason);
        }
    }

    private void CloseConsumer()
    {
        try
        {
            _consumer.Close();
        }
        catch (KafkaException ex)
        {
            KafkaConsumerLoopLog.CloseFailed(_logger, ex.Error.Code, ex.Error.Reason);
        }
    }

    private sealed class Batch
    {
        public List<TMessage> Messages { get; } = [];

        public List<ActivityLink> Links { get; } = [];

        /// <summary>Ссылка на спан <c>process</c> каждого сообщения из <see cref="Messages"/> (для поштучного прогона).</summary>
        public List<IReadOnlyList<ActivityLink>> MessageLinks { get; } = [];

        /// <summary>Сколько сообщений прочитано, включая ядовитые (предел батча — по ним, а не по партициям).</summary>
        public int Count { get; set; }

        /// <summary>Следующий офсет к коммиту по каждой партиции (включая ядовитые сообщения).</summary>
        public Dictionary<TopicPartition, Offset> Offsets { get; } = [];
    }
}
