# План: этап 4 «Сервисы»

Спека: docs/spec/portfolio-mvp.md (FR12, FR13, FR17, NFR4–NFR7, AC8–AC10) · Дизайн: docs/design/architecture.md §5–6, §9–10
· Этапы: docs/plans/roadmap.md (E4-T0…E4-T8) · ADR: 0002 (Kafka, две consumer group), 0004 (контент как JSON), 0006 (VPS + Compose)

Цель этапа: сайт работает на собственном бэкенде; каждое действие посетителя — событие в `site.events.v1`,
агрегаты в PostgreSQL, живые счётчики по SignalR. Пять сервисов healthy в AppHost; повторная доставка не
дублирует агрегат; невалидное → 400, флуд → 429; content-api остановлен → сайт на снимке.

Идёт параллельно с хвостом этапа 3 (T11–T14 фронта). Бэкенд-задачи не трогают `frontend/`; единственная
фронтовая задача (T10) выполняется после закрытия этапа 3 и согласуется с пользователем отдельно.

Окружение: .NET SDK 10.0.x, Aspire 13.6 (уже в решении), Docker Desktop (нужен для Kafka/PostgreSQL в AppHost
и Testcontainers; на момент планирования демон был остановлен — запущен вручную, проверяется в T0).

Зависимости, которые добавляет этап (все названы в стеке CLAUDE.md / ADR-0002; одобрение плана = согласие;
версии — актуальные стабильные, сверяются через context7 в задаче, где впервые нужны, и фиксируются в
`Directory.Packages.props`):
- Aspire hosting: `Aspire.Hosting.PostgreSQL`, `Aspire.Hosting.Kafka` (AppHost);
  клиентские интеграции `Aspire.Npgsql.EntityFrameworkCore.PostgreSQL`, `Aspire.Confluent.Kafka`
  (дают health checks, OTel-метрики, конфиг из connection string).
- `Confluent.Kafka`, `Npgsql.EntityFrameworkCore.PostgreSQL`, `Microsoft.EntityFrameworkCore.Design`
  (миграции), `Microsoft.AspNetCore.SignalR.Client` (только тесты live-hub; хаб — в составе ASP.NET Core).
- Тесты: `Testcontainers.PostgreSql`, `Testcontainers.Kafka`.
- Сознательно **не** добавляем: Schema Registry, Avro/Protobuf, DLQ, outbox, backplane SignalR, OTel Web SDK,
  JsonSchema-валидатор на .NET (контент проверяется типизированной десериализацией + проверкой `[ADD]`;
  полная JSON Schema — в сборке фронта, AC7), Prometheus-опрос в live-hub (этап 5).

Соглашения этапа:
- Каждый сервис: `services/<svc>/` (Program.cs, `appsettings.json`), `tests/<Svc>.Tests/`. `AddServiceDefaults()` +
  `MapDefaultEndpoints()`; конфиг только из env/connection strings, которые выставляет AppHost.
- Kafka в тестах — Testcontainers (один контейнер на класс тестов, `IAsyncLifetime`); юнит-уровень — фейковый
  `IEventProducer`/`IEventSink`, чтобы валидация и обезличивание тестировались без Docker.
- Интеграционные тесты, которым нужен Docker, помечаются `Trait("Category","Integration")`; при отсутствии
  Docker падают с понятным сообщением, а не висят (таймаут старта контейнера ≤ 90 с).
- Миграции EF Core: отдельная задача на каждую схему; применяются командой `dotnet run --project services/<svc> -- migrate`
  (процесс применяет миграции и завершается). В AppHost для Development сервису передаётся
  `Database__MigrateOnStart=true` — только для локального запуска, в проде миграции — шаг деплоя (CLAUDE.md).
- Публичные контракты (события, API) — по §5.2–5.4 дизайна; отклонение = правка дизайна/ADR в той же задаче.

## Задачи
Каждая задача: укладывается в половину контекста, даёт рабочее состояние, один коммит.

- [ ] T0 — Spike: Kafka в Testcontainers и проброс trace context через заголовки (E4-T0, лимит 0,5 дня)
  - Файлы: `src/ServiceDefaults/Kafka/KafkaTracePropagation.cs` (инъекция `traceparent`/`tracestate` в
    `Headers` продюсера и извлечение родителя при consume через `Propagators.DefaultTextMapPropagator`;
    `ActivitySource` `aboutMe.Kafka`, спаны `produce site.events.v1` / `process site.events.v1` с атрибутами
    messaging.*), `src/ServiceDefaults/Kafka/KafkaDefaults.cs` (общий конфиг producer/consumer: `acks=all`,
    `enable.idempotence`, `delivery.timeout.ms=2000`), `tests/ServiceDefaults.Tests/KafkaTracePropagationTests.cs`,
    `Directory.Packages.props` (Confluent.Kafka, Testcontainers.Kafka), `docs/learnings.md` (итог спайка).
  - Перед кодом: через context7 сверить Confluent.Kafka (API `Headers`, KRaft-совместимость образа Testcontainers)
    и Aspire.Confluent.Kafka для .NET 10.
  - Тест сначала: поднять Kafka (Testcontainers), в `Activity` A произвести сообщение через обёртку, прочитать его
    консьюмером → `Activity` consume имеет тот же `TraceId`, что A, и `ParentSpanId` = SpanId спана produce.
    Второй тест: сообщение без заголовков → consume создаёт новый корневой трейс (не падает).
  - Готово, когда: оба теста зелёные с реальной Kafka (вывод `dotnet test --project tests/ServiceDefaults.Tests`);
    `docker info` работает; в learnings — версия образа Kafka, время старта контейнера, подводные камни.
    Если за 0,5 дня трейс не пробрасывается — записать причину и предложить обход (ручной `traceparent` в payload).
  - Зависит от: —

- [ ] T1 — Contracts: событие `site.events.v1` и валидация (E4-T1)
  - Файлы: `src/Contracts/Contracts.csproj`, `src/Contracts/Events/SiteEvent.cs` (record: eventId, type, occurredAt,
    receivedAt, sessionHash, lang, theme, device, payload — по §5.4), `src/Contracts/Events/EventTypes.cs`,
    `src/Contracts/Events/IncomingEvent.cs` (то, что шлёт браузер: без sessionHash/receivedAt/device, c sessionId),
    `src/Contracts/Events/EventValidator.cs` (тип ∈ 5; eventId — UUIDv7; occurredAt ± 1 сутки от now; lang ∈ en|ru;
    theme ∈ day|evening|night; payload по типу: visit{source ∈ hh|linkedin|tg|cv|direct}, stop_opened{stop ≤ 32},
    skill_opened{skill ≤ 64}, cta_click{cta ∈ contact|cv|telegram|github|hh|email|bottle}, web_vital{name ∈ LCP|CLS|INP|TTFB|FCP,
    value ≥ 0}; лишние поля payload → ошибка), `src/Contracts/Events/SiteEventJsonContext.cs` (source generator),
    `src/Contracts/Content/ContentBundleInfo.cs` (lang, contentVersion, versionHash, schemaVersion),
    `src/Contracts/Topics.cs` (`site.events.v1`, группы `projector`, `live-hub`, заголовок `schema-version`),
    `tests/Contracts.Tests/EventValidatorTests.cs`, `tests/Contracts.Tests/SiteEventSerializationTests.cs`, `aboutMe.slnx`.
  - Тест сначала: таблица валидных/невалидных событий (по одному на каждое правило) → валидатор возвращает
    список ошибок с путём поля; round-trip сериализации `SiteEvent` даёт байт-в-байт тот же JSON, что пример в §5.4
    (с учётом порядка полей).
  - Готово, когда: тесты зелёные, `dotnet build` 0 предупреждений; схема события в §5.4 дизайна и код не расходятся
    (поля и допустимые значения перечислены в одном месте — в Contracts, дизайн ссылается на него).
  - Зависит от: — (параллельно с T0)

- [ ] T2 — events-api: приём, валидация, обезличивание, продюсер (E4-T4)
  - Файлы: `services/events-api/` (Program.cs; `Endpoints/EventsEndpoints.cs` — `POST /api/events`: одно событие
    или массив ≤ 20 только `web_vital`, тело ≤ 16 КБ, невалидно → 400 ProblemDetails со списком ошибок, иначе 202;
    `Anonymizer.cs` — `sessionHash = base64url(HMAC-SHA256(sessionId, dailySalt))`, соль в памяти, ротация по
    UTC-суткам; `DeviceClass.cs` — desktop/mobile по `User-Agent` (только класс, UA не сохраняется);
    `IEventProducer` + `KafkaEventProducer` на обёртке из T0: ключ = sessionHash, заголовки `traceparent`,
    `schema-version`; таймаут доставки 2 с → 503 ProblemDetails), `appsettings.json`,
    `tests/EventsApi.Tests/EventsEndpointTests.cs` (WebApplicationFactory + фейковый продюсер),
    `tests/EventsApi.Tests/AnonymizerTests.cs`, `tests/EventsApi.Tests/KafkaProducerTests.cs` (Integration: реальная
    Kafka, сообщение дошло с заголовком `traceparent`), `aboutMe.slnx`, `Directory.Packages.props`.
  - Тест сначала: валидное `cta_click` → 202 и в фейковом продюсере одно сообщение с `sessionHash` ≠ `sessionId`,
    без IP/UA; невалидное (нет `type`) → 400 с `errors`; массив из 2 `cta_click` → 400; массив из 20 `web_vital` → 202;
    21 → 400; продюсер бросает таймаут → 503; одинаковый `sessionId` в разные UTC-сутки → разные `sessionHash`
    (часы инжектируются через `TimeProvider`).
  - Готово, когда: тесты зелёные; `dotnet run --project services/events-api` → `/health` 200 при доступной Kafka;
    в логах запросов нет sessionId, IP и UA (проверка тестом на `FakeLogger`).
  - Зависит от: T0, T1

- [ ] T3 — projector: схема `stats` и миграция (E4-T5, часть 1)
  - Файлы: `services/projector/Projector.csproj`, `services/projector/Data/StatsDbContext.cs` (схема `stats`:
    `daily_visits(day, source, device, visits)`, `stop_opens(day, stop, n)`, `cta_clicks(day, cta, source, n)`,
    `web_vitals(day, name, bucket, n)` — гистограмма бакетов для p75, `processed_events(event_id pk, processed_at)`;
    составные PK по измерениям), `services/projector/Data/Migrations/*` (первая миграция),
    `services/projector/Program.cs` (пока: ServiceDefaults, DbContext из connection string `stats`, команда
    `migrate`, `/health` с проверкой БД), `tests/Projector.Tests/StatsSchemaTests.cs` (Integration: Testcontainers
    PostgreSQL), `aboutMe.slnx`, `Directory.Packages.props`.
  - Тест сначала: применить миграции на чистой PostgreSQL → таблицы существуют в схеме `stats`; повторное
    применение — no-op; `processed_events` отвергает дубликат PK.
  - Готово, когда: тесты зелёные; `dotnet run --project services/projector -- migrate` на локальной БД
    завершается 0; `dotnet ef migrations list` показывает одну миграцию.
  - Зависит от: — (параллельно с T0–T2)

- [ ] T4 — projector: consumer group `projector`, идемпотентная проекция (E4-T5, часть 2; AC8-данные, TC-12)
  - Файлы: `services/projector/Projection/ProjectorWorker.cs` (BackgroundService: consumer `projector`,
    `enable.auto.commit=false`, `auto.offset.reset=earliest`; батч ≤ 200 или 500 мс; одна транзакция:
    `INSERT processed_events ON CONFLICT DO NOTHING` → для новых — UPSERT агрегатов; затем commit офсета;
    спан `process` на сообщение от `traceparent` + span links на спан транзакции), `Projection/Aggregator.cs`
    (чистые функции событие → изменения агрегатов; бакеты web_vital), `Projection/PoisonCounter.cs`
    (метрика `events_poison_total`, офсет двигается), `Program.cs` (регистрация, `--rebuild`: TRUNCATE stats +
    сброс офсетов группы), `tests/Projector.Tests/AggregatorTests.cs`, `tests/Projector.Tests/ProjectorWorkerTests.cs`
    (Integration: Kafka + PostgreSQL).
  - Тест сначала: юнит — 3 события `stop_opened{stop: profile}` за один день → `stop_opens.n = 3`;
    интеграция — произвести `cta_click` и его дубль с тем же eventId → `cta_clicks.n = 1` ровно, в `processed_events`
    одна строка; ядовитое сообщение (не JSON) → счётчик poison +1, следующее событие обработано.
  - Готово, когда: тесты зелёные; `--rebuild` на тестовой БД пересчитывает агрегаты из журнала в те же числа.
  - Зависит от: T0, T1, T3

- [ ] T5 — content-api: схема `content`, миграция, сид из JSON, `GET /api/content/{lang}` с ETag (E4-T3)
  - Файлы: `services/content-api/` (`ContentApi.csproj`, `Data/ContentDbContext.cs` — `content.bundles(lang pk,
    content_version, version_hash, json jsonb, updated_at)`, `Data/Migrations/*`, `Seeding/ContentSeeder.cs` —
    при старте читает `content/{en,ru}.json` (путь из конфига `Content:Path`, в AppHost — корень репо; в образе —
    копия в `/app/content`), типизированная десериализация в `Contracts` DTO-снимка (contentVersion, lang, schemaVersion)
    + проверка отсутствия `[ADD]`, upsert при изменении SHA-256; `Endpoints/ContentEndpoints.cs` — `GET /api/content/{lang}`:
    тело = `json` как есть, `ETag: "<version_hash>"`, `Cache-Control: public, max-age=600`, output cache 10 мин,
    `If-None-Match` → 304, неизвестный lang → 404; `Program.cs` с `migrate`), `tests/ContentApi.Tests/*`
    (Integration: PostgreSQL), `aboutMe.slnx`, `Directory.Packages.props`.
  - Тест сначала: после старта на чистой БД `GET /api/content/en` → 200, `contentVersion` совпадает с файлом, ETag
    задан; тот же запрос с `If-None-Match` → 304; `/api/content/de` → 404; изменить файл → после рестарта
    новый ETag; файл с `[ADD]` → сервис не стартует (health unhealthy, лог с путём поля).
  - Готово, когда: тесты зелёные; `curl -i localhost:<port>/api/content/ru` показывает ETag и 304 при повторе.
  - Зависит от: T1 (DTO) — параллельно с T2–T4

- [ ] T6 — live-hub: consumer group `live-hub`, счётчики в памяти, SignalR `/hubs/live` (E4-T6; AC9, TC-13)
  - Файлы: `services/live-hub/` (`LiveHub.csproj`, `Live/LiveState.cs` — онлайн = уникальные sessionHash за 5 мин,
    событий сегодня, счётчики по типам/остановкам; потокобезопасно; `Live/LiveConsumerWorker.cs` — группа
    `live-hub`, автокоммит, при старте `OffsetsForTimes(начало суток UTC)` и перечитывание сегодняшних событий;
    `Live/LiveBroadcaster.cs` — `counters` не чаще 1 раза/с при изменениях, `metrics` раз в 10 с (в этом этапе —
    заглушка «нет данных» с отметкой времени, Prometheus — этап 5); `Hubs/LiveHub.cs` — при подключении снапшот;
    метрика `signalr_connections`; `Program.cs`), `src/Contracts/Live/LiveSnapshot.cs` (контракт сообщений
    хаба), `tests/LiveHub.Tests/LiveStateTests.cs`, `tests/LiveHub.Tests/LiveHubTests.cs` (Integration: Kafka +
    SignalR-клиент на TestServer).
  - Тест сначала: юнит — 2 события одной сессии и 1 другой → online = 2; событие 6 мин назад выпадает из online;
    интеграция — клиент подключился → получил снапшот; произведено `stop_opened` → клиент получил `counters`
    с +1 за ≤ 2 с; рестарт воркера → счётчик «сегодня» восстановлен из журнала.
  - Готово, когда: тесты зелёные; падение projector не влияет на live-hub (разные группы — проверка в T9).
  - Зависит от: T0, T1 — параллельно с T4, T5

- [ ] T7 — gateway: маршруты, rate limit, CORS, фильтр ботов, forwarded headers, `/health` внутренний (E4-T2, E4-T2b)
  - Файлы: `services/gateway/Program.cs`, `appsettings.json` (YARP: `GET /api/content/{**}` → content-api,
    `POST /api/events` → events-api, `POST /api/messages` → events-api, `/hubs/live` → live-hub с WebSocket;
    адреса через service discovery `https+http://content-api` и т. д.), `services/gateway/Policies/*`
    (rate limiter: `events` 60/мин на IP, `messages` 3/ч на IP, `hubs` ≤ 3 соединений на IP; 429 ProblemDetails
    с `Retry-After`; тело ≤ 16 КБ / ≤ 4 КБ по маршруту; CORS только origin-ы из `Cors:Origins`, методы GET/POST,
    заголовки `Content-Type, traceparent`; фильтр ботов по `User-Agent` → для `/api/events` 204 без проксирования;
    `ForwardedHeaders` только от `KnownProxies` из конфига, `ForwardLimit=1`; `/health` — агрегат зависимостей
    (URI-проверки `/health` сервисов с кэшем 5 с), доступен только с хостов из `Health:AllowedHosts` (внутренняя
    сеть), иначе 404; `/alive` — наружу; логи — маска IP /24), `tests/Gateway.Tests/*` (WebApplicationFactory с
    заглушками бэкендов на `TestServer`/стабах YARP).
  - Тест сначала: 61-й POST за минуту с одного IP → 429 с `Retry-After`; `X-Forwarded-For` от незнакомого адреса
    игнорируется (лимит считается по реальному); UA `Googlebot` → 204 и бэкенд не вызван; preflight OPTIONS с чужим
    origin → без CORS-заголовков; тело 17 КБ → 413; `/health` с внешнего Host → 404, с разрешённого → 200/503
    по состоянию бэкендов; `/api/content/en` проксируется на стаб content-api с сохранением ETag.
  - Готово, когда: тесты зелёные; TC-15 воспроизводится `curl` (200 запросов за 10 с → 429).
  - Зависит от: T2, T5, T6 (нужны реальные маршруты; стабы — для тестов можно раньше)

- [ ] T8 — AppHost: PostgreSQL + Kafka + 5 сервисов, миграции в dev, тест «все healthy» (шлюз этапа)
  - Файлы: `src/AppHost/AppHost.cs` (`AddPostgres` с БД `content` и `stats` и двумя ролями по §5.8 — роли через
    init-скрипт; `AddKafka` с UI; топик `site.events.v1` (3 партиции) создаётся сервисом events-api при старте,
    если нет; сервисы с `WithReference`, `WaitFor`, `WithHttpHealthCheck`; `Database__MigrateOnStart=true` для dev;
    env для gateway: `Cors__Origins`, `Health__AllowedHosts`), `src/AppHost/AppHost.csproj`,
    `tests/AppHost.Tests/AppHostTests.cs` (5 ресурсов healthy ≤ 120 с; `POST /api/events` через gateway → 202 →
    через ≤ 5 с в `stats.cta_clicks` строка), `README.md` (запуск одной командой, порты, дашборд),
    `CLAUDE.md` (строка структуры: все 5 сервисов).
  - Тест сначала: AppHost-тест ждёт healthy всех 5 ресурсов; до T8 падает (ресурсов нет).
  - Готово, когда: `dotnet run --project src/AppHost` — 5 сервисов + Postgres + Kafka Running/Healthy (скриншот
    дашборда в отчёт); тест зелёный.
  - Зависит от: T2–T7

- [ ] T9 — Записка в бутылке: `POST /api/messages` → Telegram (E4-T7b, FR17, TC-21)
  - Файлы: `services/events-api/Endpoints/MessagesEndpoints.cs` (`{name ≤ 80, replyTo ≤ 120, text ≤ 2000, website}`;
    `website` заполнен → 204 без отправки; валидация → 400 с ошибками по полям; успех → 202 и событие
    `cta_click{cta: bottle}` в Kafka без текста; Telegram недоступен → 503), `Telegram/TelegramClient.cs`
    (типизированный HttpClient, `sendMessage` в `Telegram:ChatId`, токен из `Telegram:BotToken`; таймаут 5 с,
    2 ретрая через стандартный resilience), `tests/EventsApi.Tests/MessagesEndpointTests.cs` (Telegram замокан
    через `HttpMessageHandler`; проверка `FakeLogger`: текста записки нет в логах, в спане — только длины),
    `services/gateway/appsettings.json` (лимит 3/ч уже из T7 — проверить тестом), `docs/design/architecture.md`
    (если что-то отклонилось).
  - Тест сначала: валидная записка → 202 и один вызов Telegram с name/replyTo/text; пустой `text` → 400 с полем;
    honeypot → 204 и 0 вызовов; Telegram 500 ×3 → 503; текст записки отсутствует в логах и в Kafka-сообщении.
  - Готово, когда: тесты зелёные; ручная проверка с реальным ботом через user-secrets (без коммита токена).
  - Зависит от: T2 — параллельно с T3–T8

- [ ] T10 — Фронт: контент из API со снимком как fallback, отправка событий, SignalR в окне Monitoring (E4-T7; AC9, AC10, TC-14)
  - Выполняется после закрытия этапа 3 и по отдельному согласованию с пользователем (трогает `frontend/`).
  - Файлы: `frontend/src/content/bundles.ts` (подмена снимка ответом API только если `contentVersion` строго
    больше), `frontend/src/telemetry/{events.ts,traceparent.ts,vitals.ts}` (sessionId в sessionStorage, UUIDv7,
    `fetch keepalive` по одному, батч web_vital ≤ 20 / 10 с / visibilitychange, `?src=`), `frontend/src/telemetry/live.ts`
    (SignalR-клиент — зависимость `@microsoft/signalr`, согласовать), окно 08 Monitoring на живых счётчиках,
    `frontend/.env.example` (`VITE_API_ORIGIN`), тесты Vitest + Playwright TC-14 (API недоступен → снимок, нет
    `pageerror`).
  - Тест сначала: Vitest — при ответе API с меньшим `contentVersion` снимок не подменяется; `cta_click` уходит
    одним POST с `traceparent`; Playwright — с заблокированным `api.` сайт без ошибок приложения.
  - Готово, когда: Playwright-сценарий AC9 (две вкладки, счётчик ≤ 2 с) и TC-14 зелёные против AppHost.
  - Зависит от: T8, этап 3 закрыт

- [ ] T11 — Сквозной интеграционный тест и шлюз этапа (E4-T8)
  - Файлы: `tests/Integration.Tests/EndToEndTests.cs` (Aspire.Hosting.Testing: `POST /api/events` через gateway →
    202 → в `stats` +1 ровно один раз при дубле (TC-12-данные); SignalR-клиент к `/hubs/live` через gateway
    получил `counters` ≤ 2 с; остановить projector → live-hub продолжает (NFR4); невалидное → 400, 200 запросов за
    10 с → 429 (TC-15); в БД нет IP (TC-20)), `docs/plans/roadmap.md` (чек-лист этапа), `docs/learnings.md`.
  - Тест сначала: сценарии выше; до T8 не запускаются.
  - Готово, когда: `dotnet test` зелёный целиком (включая Integration с Docker); `/verify` → PASS; `/review` 0 blocker/major.
  - Зависит от: T8, T9

Параллельные группы (каждая — свой worktree): {T0, T1, T3} → {T2, T5, T6, T9 после T2} → T4 → T7 → T8 → T11; T10 отдельно.

## AC → задачи
| Критерий | Задачи |
|---|---|
| FR12 события без cookies, `visit.source` | T1, T2, T10 |
| FR13 5 сервисов, топик, 2 группы, PostgreSQL, Contracts | T1–T8 |
| FR17 записка в бутылке | T9, (форма — T10) |
| NFR4 падение projector не ломает live-hub; сайт на снимке без API | T4, T6, T11, T10 |
| NFR5 один трейс браузер → Kafka → консьюмеры (данные для AC8) | T0, T2, T4, T6; Tempo — этап 5 |
| NFR6 IP не хранится, sessionHash с суточной солью, нет содержимого записок в логах | T2, T9, T11 |
| NFR7 rate limit, CORS, валидация схемы, тело ограничено | T1, T2, T7 |
| AC8 (часть данных: дубль не дублирует агрегат) | T4, T11 |
| AC9 счётчик ≤ 2 с | T6, T10, T11 |
| AC10 content-api остановлен → снимок | T5, T10 |
| TC-12, TC-13, TC-14, TC-15, TC-20, TC-21 | T11, T6/T10, T10, T7/T11, T11, T9 |
| Шлюз «все сервисы healthy» | T8 |

## Риски и откат
- Проброс trace context через Confluent.Kafka не заработает за лимит спайка → ручной `traceparent` в заголовке
  сообщения с явным `ActivityContext.Parse`; если и это нет — трейс рвётся на Kafka, фиксируем в NFR5 как долг этапа 5.
- Docker/Testcontainers нестабильны на Windows → интеграционные тесты в отдельной категории; CI гоняет их на
  Linux-раннере; локально можно `dotnet test --filter-not-trait "Category=Integration"`.
- Этап > 5 дней → запасной путь ADR-0002: projector и live-hub в одном процессе с двумя группами (контракт журнала
  не меняется); правка NFR4 в спеке.
- Kafka не влезает в память локально → образ с ограниченным heap (`KAFKA_HEAP_OPTS=-Xmx512m`) в AppHost.
- Откат любой задачи — revert коммита; миграции только аддитивные, схемы `content` и `stats` независимы, можно
  дропнуть и пересоздать (данных в проде ещё нет).
- Фронт этапа 3 параллельно меняет `frontend/` → бэкенд-задачи его не трогают; T10 — только после слияния этапа 3.
