# services/ — развёртываемые .NET-сервисы

> Подгружается при работе с файлами в `services/`. Общие правила — в корневом CLAUDE.md.

## Устройство сервиса
- Сервис — `services/<svc>/<Svc>.csproj`, Minimal APIs; в `Program.cs` — `AddServiceDefaults()` + `MapDefaultEndpoints()`.
- `Properties/launchSettings.json` с профилем http обязателен (иначе Aspire не видит эндпоинт).
- Сервис ссылается только на `src/*` (ServiceDefaults, Contracts, BuildingBlocks), не на другой сервис — проверяет
  `tests/Architecture.Tests`. Сервис регистрируется в `src/AppHost`.
- Тесты — `tests/<Svc>.Tests`; интеграционные на Testcontainers (`Trait("Category","Integration")`).

## Раскладка сервиса (ADR-0008)
```
Program.cs        композиция; вне слоёв — только Program
Api/              <Feature>Endpoint: запрос → хендлер → ответ/ProblemDetails, без логики; Hubs/ (SignalR)
Workers/          BackgroundService / Kafka-хендлер → хендлер; офсет — после успешного возврата
Application/      <Feature>/ (Command|Query, Handler.HandleAsync, Result), Abstractions/ (порты), DependencyInjection.cs
Domain/           чистая модель и функции
Infrastructure/   Persistence/ (DbContext, репозитории, Migrations/), Messaging/, External/<System>/, Realtime/, Health/,
                  DependencyInjection.cs
```
- Namespace = путь: `<Svc>.<Layer>[.<Feature>]` (IDE0130 = warning → ошибка сборки). Gateway: только `Api/Edge/Infrastructure`.
- Зависимости (проверяет `tests/Architecture.Tests/LayerRulesTests` по скомпилированным сборкам):
  - `Domain` → BCL, `Contracts`, свой `Domain`;
  - `Application` ↛ `Infrastructure/Api/Workers`, ASP.NET Core, EF Core, Npgsql, Confluent.Kafka, `BuildingBlocks.Http|Messaging`;
    DI-регистрация — только в `Application/DependencyInjection.cs`;
  - `Api`, `Workers` ↛ `Infrastructure` (можно только `Program` и `DependencyInjection`).
- Хранилище — только через репозиторий (порт в `Application/Abstractions`, реализация в `Infrastructure/Persistence`);
  транзакция — `IUnitOfWork` из `BuildingBlocks.Persistence`. С ним в `AddNpgsqlDbContext` — `settings.DisableRetry = true`.
- Хендлеры — обычные классы в DI, вызываются явно; без медиатора.
- Порядок в `Program.cs`: `Add<Svc>SpanRedaction()` (если есть) → `AddServiceDefaults()` → `Add<Svc>Application()` →
  `Add<Svc>Infrastructure()` → `Map*`.

## Контракты и данные
- Событие `site.events.v1` и DTO — только в `src/Contracts`; изменение схемы — через ADR и контрактный тест
  (снимок схемы, только вперёд-совместимые изменения).
- Повторная доставка Kafka — норма: projector/live-hub идемпотентны по `eventId`; агрегат и отметка `eventId`
  в одной транзакции (ADR-0002).
- EF Core миграции — отдельной задачей и отдельным шагом деплоя:
  `dotnet ef migrations add <Name> -o Infrastructure/Persistence/Migrations --project services/<svc>`;
  применение — `dotnet run --project services/<svc> -- migrate`.

## Ошибки и логи
- Ошибки — `ProblemDetails` (RFC 9457); необработанное → 500 без деталей исключения.
- Логи структурные в stdout с `TraceId`; IP и PII не логировать (IP — маска /24, `sessionId` — хэш с суточной солью).
- `/alive` не зависит от БД и Kafka; `/health` наружу не публикуется.
