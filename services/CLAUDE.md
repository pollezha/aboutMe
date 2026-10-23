# services/ — развёртываемые .NET-сервисы

> Подгружается при работе с файлами в `services/`. Общие правила — в корневом CLAUDE.md.

## Устройство сервиса
- Сервис — `services/<svc>/<Svc>.csproj`, Minimal APIs; в `Program.cs` — `AddServiceDefaults()` + `MapDefaultEndpoints()`.
- `Properties/launchSettings.json` с профилем http обязателен (иначе Aspire не видит эндпоинт).
- Сервис ссылается только на `src/*` (ServiceDefaults, Contracts), не на другой сервис — проверяет
  `tests/Architecture.Tests`. Сервис регистрируется в `src/AppHost`.
- Тесты — `tests/<Svc>.Tests`; интеграционные на Testcontainers (с этапа 4).

## Контракты и данные
- Событие `site.events.v1` и DTO — только в `src/Contracts`; изменение схемы — через ADR и контрактный тест
  (снимок схемы, только вперёд-совместимые изменения).
- Повторная доставка Kafka — норма: projector/live-hub идемпотентны по `eventId`; агрегат и отметка `eventId`
  в одной транзакции (ADR-0002).
- EF Core миграции — отдельной задачей и отдельным шагом деплоя.

## Ошибки и логи
- Ошибки — `ProblemDetails` (RFC 9457); необработанное → 500 без деталей исключения.
- Логи структурные в stdout с `TraceId`; IP и PII не логировать (IP — маска /24, `sessionId` — хэш с суточной солью).
- `/alive` не зависит от БД и Kafka; `/health` наружу не публикуется.
