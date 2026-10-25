# aboutMe

> Держи этот файл коротким (до ~80 строк). Детали — в docs/, здесь только ссылки.
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
# все проверки тихо: строка ok/FAIL на шаг, хвост вывода только у упавших (CHECK_TAIL=40); код 1 при падении
bash scripts/check.sh [dotnet|frontend|hook|all]
# .NET (из корня): сборка, тесты (MTP + xUnit v3), формат; точечно — один тест
dotnet build && dotnet test && dotnet format --verify-no-changes
dotnet test --project tests/Gateway.Tests --filter-method "*Unknown_api_route*"
# фронт — команды в frontend/CLAUDE.md; локальный запуск всего через Aspire
dotnet run --project src/AppHost
# один раз на машине (иначе сборка AppHost падает ASPIRE009)
dotnet dnx --yes aspire.cli@13.6.1 -- setup --install-path ~/.aspire
```

## Структура
```
frontend/   # Vue 3 + TS + Vite + TresJS, свои тесты (Vitest, Playwright)
services/   # развёртываемые .NET-сервисы: gateway, content-api, events-api, projector, live-hub
src/        # общие .NET-проекты: ServiceDefaults, AppHost (Aspire); Contracts (E4-T1); BuildingBlocks (ADR-0008)
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
- Слои: правила сервисов — `services/CLAUDE.md` (ссылки между проектами проверяет `tests/Architecture.Tests`); фронта — `frontend/CLAUDE.md` (границы проверяет ESLint).
- Ошибки и логи: ответы об ошибках — `ProblemDetails` (RFC 9457), необработанное → 500 без деталей исключения; логи структурные в stdout с `TraceId`; IP и PII не логировать (design §5.1–5.2).
- БД: EF Core миграции — отдельной задачей и отдельным шагом деплоя, только вперёд-совместимые; projector пишет агрегат и отметку `eventId` в одной транзакции (ADR-0002).
- Секреты только через переменные окружения / user-secrets. Никогда не коммитить `.env`.
- Каждая фича — тесты на поведение, а не на реализацию.

## Процесс работы с агентом
`/spec` → `/architecture` (ADR, если меняется структура) → `/plan` → `/implement` (задача = коммит, тест сначала) →
`/verify` → `/review` (≤ 3 раундов, REVIEW.md) → `/learn`. Подробно — `docs/claude-workflow.md`. Мелочи — сразу implement + verify.
UI: код идёт от дизайна — Figma источник истины, приёмка по парам кадров Figma ↔ сайт (`docs/design/visual-acceptance.md`).
Задачи — максимально мелкие (фронт: модуль / элемент / кусок логики); итоги и нюансы — в спеке модуля `docs/spec/frontend/`.
Вывод команд: не выводить файлы целиком (grep, диапазон строк), проверки — через `scripts/check.sh`, при падении смотреть только упавшее.

**Оркестрация.** Основная сессия (модель Fable) — оркестратор: планирует, поручает, проверяет, коммитит, ведёт
шлюзы этапов. Код пишет сабагент `implementer` (Opus, свежий контекст на задачу), ревьюят `reviewer` и
`verifier` (Opus). Оркестратор не читает исходники и логи целиком — работает через планы, отчёты, `git diff --stat`
и хвосты вывода проверок; картинки визуальной приёмки смотрит сам всегда. Независимые задачи — параллельно в worktree.

## Окружение
- Windows 11, Git Bash. Хуки запускаются через `bash`, логика хука — на node (jq не нужен).
- Плагины (scope project, `.claude/settings.json`; переустановка — `bash scripts/install-plugins.sh`): csharp-lsp, typescript-lsp, context7 (свежие доки .NET 10/Aspire/TresJS), playwright, github, frontend-design, figma, streaming-skills-plugin (Kafka); grafana-mcp — к этапу мониторинга.
- Концепт: `docs/concept/plan.md` (план) и `docs/concept/mockup-v6.html` (актуальный концепт-арт, не финальный дизайн; v5 — предыдущий). Большие HTML/картинки не вставлять в чат — только путь к файлу.
- Хук `.claude/hooks/guard-protected-files.sh` (логика в `.js`) блокирует правку `.env*`, `secrets/`, ключей, lock-файлов и `.github/workflows/` через Edit/Write и через команды Bash/PowerShell (cp/sed -i/rm/redirect/Set-Content), а также чтение секретов (cat .env). Тесты хука: `node --test .claude/hooks/guard-protected-files.test.js` (гонять после каждой правки); lock-файлы меняются только через npm/dotnet.

## Чего не делать
- Не добавлять зависимости без явного согласия.
- Не менять публичные контракты (API, схемы событий, миграции) без ADR.
- Не отключать и не удалять тесты, чтобы «прошло».
- Не говорить «готово» без вывода `/verify`.
