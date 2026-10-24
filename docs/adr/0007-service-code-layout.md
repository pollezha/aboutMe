# ADR-0007: Единая раскладка кода сервиса — слои Api/Application/Domain/Infrastructure, общая библиотека BuildingBlocks

Статус: accepted · Дата: 2026-10-24

## Контекст
К концу группы задач T2–T7 этапа 4 пять сервисов написаны пятью свежими контекстами агента, и у каждого своя
раскладка: `events-api/Endpoints/*.cs` на 200+ строк с валидацией, обезличиванием и продюсером в одном файле;
`projector/Projection/*` смешивает доменную логику (Aggregator, VitalBuckets) с инфраструктурой (StatsWriter,
KafkaHealthCheck); `content-api/Seeding`, `live-hub/Live`, `gateway/Policies` — названия без общего словаря.
Доступ к БД идёт напрямую через `DbContext` из обработчиков, без интерфейсов. Общий код лежит в `ServiceDefaults`
(хостинг: OTel, health) вперемешку с Kafka-обёрткой; чтение тела с лимитом скопировано в два эндпоинта.
Контракты (`src/Contracts`) — единственная общая граница.

Драйверы:
1. **Понятность человеку и агенту.** Публичный репозиторий — доказательство навыка (G6). Агент работает в свежем
   контексте на задачу: предсказуемая раскладка позволяет найти место правки по имени папки, не читая весь сервис.
2. **Гибкость.** Этап 5 добавит в live-hub опрос Prometheus, в projector — новые агрегаты. Замена инфраструктуры
   (Kafka → Redpanda, Telegram → email) не должна трогать логику.
3. **Тестируемость.** Юнит-тесты домена и хендлеров без Docker; интеграционные — только для адаптеров.
4. **Малый размер.** 1–3 эндпоинта на сервис, один разработчик. Проекты-слои на каждый сервис (16 csproj) — перебор.
5. Уже принятые решения: Minimal APIs (ADR-0001, стек CLAUDE.md), контракты в `src/Contracts`, Aspire
   `ServiceDefaults` как хостинговая конвенция, идемпотентность projector в одной транзакции (ADR-0002).

## Рассмотренные варианты

| Вариант | Плюсы | Минусы | Стоимость изменения потом |
|---|---|---|---|
| A. Оставить как есть, выровнять только имена папок | Ничего не переписывать | Логика и инфраструктура в одних файлах; нет портов/репозиториев; каждый сервис читается заново | Низкая сейчас, растёт с каждым этапом |
| B. **Один проект на сервис, фиксированные слои-папки** `Api / Application / Domain / Infrastructure / Workers`, вертикальные срезы в `Application` по фичам, порты (репозитории и внешние системы) как интерфейсы в `Application`, реализации в `Infrastructure`; общая библиотека `src/BuildingBlocks`; `ServiceDefaults` — только хостинг | Единый словарь для 5 сервисов; зависимости слоёв проверяются тестом; замена адаптера = один файл; без новых пакетов | Больше файлов (один класс — один файл); дисциплина границ | Средняя: переезд файлов внутри проекта |
| C. Clean Architecture проектами: `<Svc>.Domain / .Application / .Infrastructure / .Api` | Компилятор запрещает нарушение слоёв | 4 csproj × 4 сервиса, медленнее сборка, тяжело для сервисов из 2 эндпоинтов | Высокая |
| D. MVC-контроллеры + MediatR | Знакомый шаблон, конвейер behaviors | Новая зависимость (MediatR с v13 — коммерческая лицензия), отход от Minimal APIs; магия диспетчеризации читается хуже явного вызова | Средняя |

## Решение
Вариант B. Один проект на сервис, одинаковые папки-слои, явные хендлеры и порты через интерфейсы, общая
библиотека `src/BuildingBlocks`. Minimal APIs остаются: класс `*Endpoint` в `Api/` играет роль контроллера —
маршрут, привязка запроса, вызов хендлера, перевод результата в HTTP; никакой логики.

### Фичи (домены) и сервисы
Домен = имя папки `Application/<Feature>`; одно имя — одно значение во всём репозитории.

| Сервис | Фичи в `Application/` | Порты в `Application/Abstractions/` |
|---|---|---|
| content-api | `GetContent`, `SeedContent` | `IContentBundleRepository`, `IContentSource` |
| events-api | `IngestEvents`, `SendContactMessage` («записка в бутылке») | `IEventPublisher`, `IContactMessageDelivery`, `IDailySalt` |
| projector | `ProjectEvents`, `RebuildStats` | `IProcessedEventsRepository`, `IStatsRepository`, `IUnitOfWork`, `IConsumerOffsets` |
| live-hub | `ApplyLiveEvent`, `GetLiveSnapshot` | `ILiveStateRepository` (in-memory), `ILiveNotifier` |
| gateway | — (нет домена: маршруты и политики; слои `Application/Domain` отсутствуют осознанно) | — |

Слово «Messaging» зарезервировано за Kafka (`Infrastructure/Messaging`, `BuildingBlocks/Messaging`); записки — `Contact`.

### Раскладка сервиса (обязательная)
```
services/<svc>/
  Program.cs                      композиция: AddServiceDefaults → Add<Svc>Application → Add<Svc>Infrastructure → Map*
  Api/                            точка входа HTTP/SignalR («контроллеры»)
    <Feature>Endpoint.cs          MapGroup; запрос → хендлер → ответ/ProblemDetails
    Hubs/<Name>Hub.cs             SignalR-хаб (live-hub)
  Workers/                        точка входа из журнала/таймера: BackgroundService → хендлер; офсет коммитится
                                  только после успешного возврата хендлера
  Application/                    сценарии использования; без ASP.NET, EF, Kafka
    <Feature>/                    <Feature>Command|Query.cs, <Feature>Handler.cs (метод HandleAsync), <Feature>Result.cs при необходимости
    Abstractions/                 порты: I<Entity>Repository, I<Store>, I<ExternalSystem>
    DependencyInjection.cs        Add<Svc>Application(): хендлеры
  Domain/                         чистая модель и правила: сущности, value objects, чистые функции (Aggregator, VitalBuckets, Anonymizer)
  Infrastructure/                 адаптеры к внешнему миру
    Persistence/                  <Svc>DbContext, <Svc>DbContextDesignFactory, Migrations/ (с .editorconfig generated_code), репозитории/stores
    Messaging/                    Kafka: publisher, consumer-адаптер, TopicInitializer, offsets
    External/<System>/            Telegram, Prometheus (этап 5)
    Realtime/                     SignalR-нотификатор (реализация ILiveNotifier)
    Health/                       health checks адаптеров
    DependencyInjection.cs        Add<Svc>Infrastructure(): адаптеры, AddKafkaTracing(), процессоры OTel
```
Namespace = путь без префикса: `<Svc>.<Layer>[.<Feature>]` (например `EventsApi.Application.IngestEvents`);
включить `dotnet_diagnostic.IDE0130.severity = warning` — при TreatWarningsAsErrors компилятор проверит соответствие.

### Правила зависимостей (проверяет `tests/Architecture.Tests` через System.Reflection.Metadata, без новых пакетов)
- `Domain` → только BCL и `Contracts`.
- `Application` → `Domain`, `Contracts`, `BuildingBlocks.Application`; запрещены `Microsoft.AspNetCore*`,
  `Microsoft.EntityFrameworkCore*`, `Npgsql*`, `Confluent.Kafka`.
- `Infrastructure` → `Application`, `Domain`, любые пакеты.
- `Api`, `Workers` (точки входа) → `Application`, `BuildingBlocks.Http|Messaging`, пакеты транспорта (ASP.NET, SignalR, Confluent.Kafka);
  `Infrastructure` — только из `Program.cs` и `DependencyInjection.cs`.
- `BuildingBlocks` не ссылается на `Contracts` и сервисы; `ServiceDefaults` не ссылается на `BuildingBlocks`.

### Репозитории, Unit of Work, идемпотентность
Любой доступ к хранилищу — только через репозиторий: интерфейс в `Application/Abstractions`, реализация в
`Infrastructure/Persistence`. Один репозиторий — один агрегат/таблица-владелец; методы названы по смыслу
(`MarkProcessedAsync(eventIds) → новые`, `ApplyDeltasAsync(deltas)`, `GetByLangAsync(lang)`, `UpsertAsync(bundle)`),
без обобщённого `IRepository<T>` с CRUD (у нас нет сущностей с одинаковым жизненным циклом). Хендлеры и домен не
знают об EF, Npgsql и SQL.

Транзакция — через `IUnitOfWork` сервиса (`BeginAsync(ct)` → `CommitAsync(ct)`, `DisposeAsync` = rollback), который открывает
**настоящую транзакцию соединения** (не `SaveChanges`), а репозитории работают через тот же `DbContext`/соединение и
автоматически попадают в неё. Projector: `ProjectEventsHandler` → `uow.BeginAsync` → `processed.MarkProcessedAsync`
(`INSERT … ON CONFLICT DO NOTHING RETURNING`) → `Aggregator` (чистая функция, только новые события) →
`stats.ApplyDeltasAsync` (UPSERT) → `uow.CommitAsync`; офсет Kafka воркер коммитит после успешного возврата хендлера
(ADR-0002). Тест на уровне хендлера: при падении между `MarkProcessed` и `Commit` отметка не сохраняется — проверяется
интеграционным тестом с инъекцией сбоя в фейковый `IStatsRepository` поверх реальной БД.
Интерфейсы `IUnitOfWork` — в `BuildingBlocks/Persistence` (один контракт для всех сервисов), реализация
`EfUnitOfWork<TDbContext>` там же; репозитории — только в сервисах.

### Общие проекты
- `src/Contracts` — публичные контракты (события, DTO API, сообщения хаба). Без изменений.
- `src/ServiceDefaults` — только хостинг Aspire: OTel, health, service discovery, resilience. Kafka уезжает.
- `src/BuildingBlocks` (новый) — строительные блоки без бизнес-смысла:
  - `Messaging/Kafka/` — `KafkaTracePropagation`, `KafkaDefaults`, `KafkaConsumerLoop<T>` (consume → handler →
    commit, poison-счётчик), `AddKafkaTracing()` = `ConfigureOpenTelemetryTracerProvider(t => t.AddSource(...))` —
    вызывается из `Add<Svc>Infrastructure()` каждого Kafka-сервиса, поэтому ServiceDefaults о Kafka не знает;
  - `Http/` — `RequestBodyReader` (тело с лимитом → 413), `HttpProblems` (ProblemDetails 400/413/429/503);
  - `Observability/` — `UrlRedactionProcessor` (обобщение редакции токена Telegram) и его регистрация.
  - `Persistence/` — `IUnitOfWork`, `EfUnitOfWork<TDbContext>` (транзакция соединения через `Database.BeginTransactionAsync`).
  - Не выносим: `IClock` (есть `TimeProvider`), обобщённые `ICommandHandler/IQueryHandler` (без медиатора они
    ничего не дают — хендлер = конкретный класс с `HandleAsync`), обобщённый CRUD-`IRepository<T>`, snake_case-конфиг EF.
- Хендлеры — обычные классы в DI, вызываются явно: `await handler.HandleAsync(command, ct)`. Без медиатора.

### Переезд существующего кода (R1–R8 плана этапа 4)
- Миграции переносить `git mv` вместе с `.editorconfig`; design-time фабрики остаются в сборке сервиса; новые
  миграции — `dotnet ef migrations add <Name> -o Infrastructure/Persistence/Migrations`. Смена namespace миграциям
  не вредит (история по ID, `MigrationsHistoryTable` задана явно). Обновить маску `Migrations` в REVIEW.md.
- Порядок в `Program.cs` сохраняется: `AddServiceDefaults()` → `Add<Svc>Infrastructure()`; процессоры OTel
  регистрируются до экспортёра.
- Поведение не меняется: существующие интеграционные тесты остаются зелёными; добавляются юнит-тесты хендлеров на фейках.

## Последствия
- Становится проще: агент по имени задачи знает файлы («новый агрегат» = `Domain/Aggregator` + `Infrastructure/Persistence/StatsRepository`);
  юнит-тесты хендлеров без Docker; замена Telegram или Kafka — один класс в `Infrastructure`.
- Становится сложнее: больше файлов и интерфейсов на сервис из двух эндпоинтов; Architecture.Tests нужно поддерживать;
  переезд — отдельная группа задач до T10/T11.
- Сигнал пересмотреть: сервис перерастает 10 фич — выделить `Application` в отдельный проект (вариант C для этого
  сервиса); появится второй репозиторий-потребитель BuildingBlocks — публиковать как NuGet.
