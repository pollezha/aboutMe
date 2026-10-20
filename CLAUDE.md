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
# сборка
<build command>
# тесты (все / один)
<test command>
<test single command>
# линтер / форматтер
<lint command>
# локальный запуск (с зависимостями)
<run command>
```

## Структура
```
frontend/   # Vue 3 + TS + Vite + TresJS, свои тесты (Vitest, Playwright)
services/   # развёртываемые .NET-сервисы: gateway, content-api, events-api, projector, live-hub
src/        # общие .NET-проекты: Contracts, ServiceDefaults, AppHost (Aspire)
tests/      # тесты .NET: <Project>.Tests, интеграционные на Testcontainers
deploy/     # compose, Caddy, OTel Collector, Grafana
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
- <Именование, слои, куда класть новый код>
- <Обработка ошибок, логирование>
- <Работа с БД: миграции, транзакции>
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

## Окружение
- Windows 11, Git Bash. Хуки запускаются через `bash`; jq не нужен (хук использует node, если jq нет).
- Плагины (scope project, `.claude/settings.json`; переустановка — `bash scripts/install-plugins.sh`): csharp-lsp, typescript-lsp, context7 (свежие доки .NET 10/Aspire/TresJS), playwright, github, streaming-skills-plugin (Kafka), frontend-design, figma. grafana-mcp — к этапу мониторинга.
- Концепт: `docs/concept/plan.md` (план) и `docs/concept/mockup-route-city-v5.html` (концепт-арт, не финальный дизайн). Большие HTML/картинки не вставлять в чат — только путь к файлу.
- Хук `.claude/hooks/guard-protected-files.sh` блокирует правку `.env*`, `secrets/`, ключей, lock-файлов и `.github/workflows/` через Edit/Write.

## Чего не делать
- Не добавлять зависимости без явного согласия.
- Не менять публичные контракты (API, схемы событий, миграции) без ADR.
- Не отключать и не удалять тесты, чтобы «прошло».
- Не говорить «готово» без вывода `/verify`.
