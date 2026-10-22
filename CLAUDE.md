# aboutMe

> Держи этот файл коротким (до ~150 строк). Детали — в docs/, здесь только ссылки.
> Обновляй, когда меняются стек, соглашения или команды. Устаревшая строка хуже отсутствующей.

## Что это
Сайт-портфолио Якова (.NET backend developer, open to work): изометрический остров-город, где здания — главы резюме. Аудитория — рекрутеры (понять за 30 с) и техлиды (живой бэкенд, код, мониторинг). Спека: `docs/spec/portfolio-mvp.md`, дизайн: `docs/design/architecture.md`, этапы: `docs/plans/roadmap.md`.

## Цели / не-цели
- Цель: имя, роль, статус и контакт видны за 30 с; сайт сам доказывает стек (5 сервисов, Kafka, SignalR, OTel) — метрики M1–M5, T1–T11 в спеке.
- Не-цель (MVP): модели Blender, The Lab, блог, админка/CMS, Kubernetes, публичная Grafana, Schema Registry, DLQ, outbox, OTel Web SDK.

## Стек
> Принят в ADR-0001…0006. Новые фреймворки и зависимости — только с согласия пользователя.
- Backend: .NET 10, ASP.NET Core Minimal APIs, YARP, EF Core (Npgsql), SignalR, Confluent.Kafka, Aspire (AppHost + ServiceDefaults); тесты xUnit + Testcontainers.
- Frontend: Vue 3 + TS + Vite, TresJS + cientos, Pinia, vue-i18n, vite-ssg; тесты Vitest, Playwright, axe, Lighthouse CI, size-limit.
- Хранилища / брокеры: PostgreSQL (схемы `content`, `stats`), Kafka KRaft (топик `site.events.v1`, группы `projector`, `live-hub`).
- Инфраструктура: один VPS + Docker Compose + Caddy; фронт на Cloudflare Pages; OTel Collector → Prometheus/Loki/Tempo → Grafana; GitHub Actions + GHCR.

## Команды
```bash
# .NET (из корня): сборка, тесты (MTP + xUnit v3), формат
dotnet build
dotnet test
dotnet test --project tests/Gateway.Tests --filter-method "*Unknown_api_route*"
dotnet format --verify-no-changes
# фронт (из frontend/); build сначала валидирует content/*.json
npm run lint && npm run format:check && npm run typecheck && npm test && npm run build
npx vitest run src/__tests__/App.spec.ts -t "English"
npm run gen:theme  # palette.ts + tokens.css из снимка Figma (идемпотентно)
npm run shots      # сборка + 8 скриншотов первого экрана → docs/design/shots/ (нужен Chrome; CHROME_PATH)
npm run og         # public/og.png 1200×630 + favicon-192/512.png (headless Chrome)
# локальный запуск: всё через Aspire / только фронт на снимке контента
dotnet run --project src/AppHost
npm run dev
# один раз на машине (иначе сборка AppHost падает ASPIRE009)
dotnet dnx --yes aspire.cli@13.6.1 -- setup --install-path ~/.aspire
```

## Структура
```
frontend/   # Vue 3 + TS + Vite + TresJS, свои тесты (Vitest, Playwright)
services/   # развёртываемые .NET-сервисы: gateway, content-api, events-api, projector, live-hub (сейчас только gateway)
src/        # общие .NET-проекты: ServiceDefaults, AppHost (Aspire); Contracts (E4-T1)
tests/      # тесты .NET: <Project>.Tests; интеграционные на Testcontainers — с этапа 4
deploy/     # (этап 5–6) compose, Caddy, OTel Collector, Grafana
content/    # контент EN/RU в JSON
docs/concept/ # исходный план и концепт-арт (см. ADR-0001)
docs/spec/  # спецификации фич (скилл /spec)
docs/adr/   # архитектурные решения (скилл /architecture)
docs/plans/ # планы реализации (скилл /plan)
docs/learnings.md  # накопленные уроки (скилл /learn)
docs/claude-workflow.md  # описание процесса и рекомендуемых плагинов
.claude/    # скилы, сабагенты, хук защиты файлов
```

## Соглашения
- Слои: сервис — `services/<svc>`, общий .NET-код — `src/ServiceDefaults` (каждый сервис: `AddServiceDefaults()` + `MapDefaultEndpoints()`); фронт — `frontend/src/{content,stores,theme,scene,ui,fallback2d,telemetry,i18n}`.
- Ошибки и логи: ответы об ошибках — `ProblemDetails` (RFC 9457), необработанное → 500 без деталей исключения; логи структурные в stdout с `TraceId`; IP и PII не логировать (design §5.1–5.2).
- БД: EF Core миграции — отдельной задачей и отдельным шагом деплоя, только вперёд-совместимые; projector пишет агрегат и отметку `eventId` в одной транзакции (ADR-0002).
- Секреты только через переменные окружения / user-secrets. Никогда не коммитить `.env`.
- Каждая фича — тесты на поведение, а не на реализацию.

## Процесс работы с агентом
1. `/spec` → `docs/spec/<feature>.md`
2. `/architecture` → ADR, если решение влияет на структуру
3. `/plan` → атомарные задачи в `docs/plans/<feature>.md`
4. `/implement` → одна задача = один коммит, тесты сначала
5. `/verify` → доказательства, что работает (сборка, тесты, запуск)
6. `/review` → ревью в чистом контексте по REVIEW.md (макс. 3 раунда)
7. `/learn` → уроки в docs/learnings.md, правки CLAUDE.md / REVIEW.md

Для мелочей (опечатка, однострочный фикс) — сразу implement + verify.

**Оркестрация.** Основная сессия (модель Fable) — оркестратор: планирует, поручает, проверяет, коммитит, ведёт
шлюзы этапов. Код пишет сабагент `implementer` (Opus, свежий контекст на задачу), ревьюят `reviewer` и
`verifier` (Opus). Оркестратор не читает исходники и логи целиком — работает через планы, отчёты, `git diff --stat`
и хвосты вывода проверок. Независимые задачи — параллельно в worktree.

## Окружение
- Windows 11, Git Bash. Хуки запускаются через `bash`, логика хука — на node (jq не нужен).
- Плагины (scope project, `.claude/settings.json`; переустановка — `bash scripts/install-plugins.sh`): csharp-lsp, typescript-lsp, context7 (свежие доки .NET 10/Aspire/TresJS), playwright, github, streaming-skills-plugin (Kafka), frontend-design, figma. grafana-mcp — к этапу мониторинга.
- Концепт: `docs/concept/plan.md` (план) и `docs/concept/mockup-v6.html` (актуальный концепт-арт, не финальный дизайн; v5 — предыдущий). Большие HTML/картинки не вставлять в чат — только путь к файлу.
- Хук `.claude/hooks/guard-protected-files.sh` (логика в `.js`) блокирует правку `.env*`, `secrets/`, ключей, lock-файлов и `.github/workflows/` через Edit/Write и через команды Bash/PowerShell (cp/sed -i/rm/redirect/Set-Content), а также чтение секретов (cat .env). Тесты хука: `node --test .claude/hooks/guard-protected-files.test.js` (гонять после каждой правки); lock-файлы меняются только через npm/dotnet.

## Чего не делать
- Не добавлять зависимости без явного согласия.
- Не менять публичные контракты (API, схемы событий, миграции) без ADR.
- Не отключать и не удалять тесты, чтобы «прошло».
- Не говорить «готово» без вывода `/verify`.
