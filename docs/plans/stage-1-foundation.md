# План: этап 1 «Фундамент»

Спека: docs/spec/portfolio-mvp.md · Дизайн: docs/design/architecture.md · Этапы: docs/plans/roadmap.md (E1-T1…E1-T6)
ADR: 0001 (структура), 0004 (контент как JSON), 0005 (Vue + TresJS), 0006 (CI/CD)

Цель этапа: пустой, но собираемый и проверяемый монорепозиторий — .NET-решение с одним сервисом в AppHost,
Vue-каркас, валидатор контента, CI. Окружение проверено: .NET SDK 10.0.302, Node 24.18, Docker 29.6.

Зависимости, которые добавляет этап (одобрение плана = согласие на них; версии — актуальные стабильные,
проверяются через context7 в T1 и фиксируются в `Directory.Packages.props` / `package.json`):
- .NET: Aspire (AppHost, ServiceDefaults, Hosting.Testing), OpenTelemetry (через ServiceDefaults),
  Microsoft.Extensions.Http.Resilience, Yarp.ReverseProxy, xUnit, Microsoft.AspNetCore.Mvc.Testing.
- npm: vue, vue-router, pinia, vue-i18n, vite, @vitejs/plugin-vue, typescript, vue-tsc, vitest, @vue/test-utils,
  jsdom, eslint + eslint-plugin-vue + typescript-eslint, prettier, ajv, tsx.
- Сознательно **не** в этом этапе: TresJS/three, vite-ssg, Playwright, Lighthouse CI, size-limit (этап 3);
  Kafka, EF Core, SignalR, Testcontainers (этап 4).

## Задачи
Каждая задача: укладывается в половину контекста, даёт рабочее состояние, один коммит.

- [x] T1 — Каркас .NET-решения и ServiceDefaults
  - Файлы: `global.json` (SDK 10.0.x, rollForward latestFeature), `aboutMe.slnx`, `Directory.Build.props`
    (net10.0, Nullable, ImplicitUsings, TreatWarningsAsErrors, AnalysisLevel latest-recommended),
    `Directory.Packages.props` (central package management), дополнение `.editorconfig` для C#,
    `src/ServiceDefaults/` (`AddServiceDefaults()`: OTel, health checks, resilience; `MapDefaultEndpoints()`:
    `/health`, `/alive`), `tests/ServiceDefaults.Tests/`.
  - Перед кодом: через context7 сверить текущие версии Aspire и API ServiceDefaults для .NET 10; итог —
    одной строкой в `docs/learnings.md`.
  - Тест сначала: тестовый хост с `AddServiceDefaults()` + `MapDefaultEndpoints()` → `GET /alive` = 200,
    `GET /health` = 200; без `MapDefaultEndpoints` → 404 (тест падает до реализации).
  - Готово, когда: `dotnet build` — 0 предупреждений, `dotnet test` зелёный,
    `dotnet format --verify-no-changes` чистый.
  - Зависит от: —

- [x] T2 — Сервис gateway (заглушка YARP)
  - Файлы: `services/gateway/` (Program.cs: ServiceDefaults + YARP из конфигурации, пока без маршрутов;
    `appsettings.json`), `tests/Gateway.Tests/` (WebApplicationFactory).
  - Тест сначала: `GET /health` и `/alive` → 200; неизвестный маршрут `/api/x` → 404 (а не 500).
  - Готово, когда: тесты зелёные, сборка без предупреждений, `dotnet run` gateway отвечает на `/health`.
  - Зависит от: T1

- [ ] T3 — AppHost (Aspire) поднимает gateway
  - Файлы: `src/AppHost/` (gateway как project-ресурс), `tests/AppHost.Tests/` (Aspire.Hosting.Testing).
  - Тест сначала: интеграционный — запустить `DistributedApplication` из AppHost, дождаться, пока ресурс
    `gateway` станет healthy, `GET /health` через выданный клиент → 200.
  - Готово, когда: тест зелёный; `dotnet run --project src/AppHost` открывает дашборд Aspire, gateway
    в статусе Running/Healthy (скриншот или вывод в PR).
  - Зависит от: T2

- [ ] T4 — Каркас фронтенда (Vue 3 + TS + Vite + Pinia + vue-i18n + линтеры)
  - Файлы: `frontend/` (`package.json`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`,
    `.prettierrc`, `index.html`, `src/main.ts`, `src/App.vue`, `src/i18n/{index.ts,en.json,ru.json}`,
    `src/stores/ui.ts`), `frontend/src/__tests__/App.spec.ts`. Скрипты: `dev`, `build`, `lint`, `format:check`,
    `typecheck`, `test`.
  - Тест сначала: Vitest монтирует `App` → виден заголовок из i18n (имя и роль, EN); после
    `ui.setLang('ru')` — строка на русском.
  - Готово, когда: `npm run lint && npm run typecheck && npm test && npm run build` — всё зелёное.
  - Зависит от: — (параллельно с T1–T3)

- [ ] T5 — Схема контента и валидатор в сборке (FR9, AC7)
  - Файлы: `content/schema/content.schema.json` (JSON Schema: profile, chapters, skills с датами, links),
    `content/en.json` (минимальный, только подтверждённые данные: имя, роль, ссылки GitHub/Telegram/hh;
    без `[ADD]`), `frontend/scripts/validate-content.ts` (Ajv + правила: нет строк с `[ADD]`, нет `href`
    `#` или пустых ссылок; сообщение называет файл и JSON-путь поля), `frontend/scripts/__tests__/validate-content.spec.ts`
    с фикстурами; `prebuild` → валидатор.
  - Тест сначала (TC-10): фикстура с `[ADD]` → ошибка с путём поля; фикстура с `"href": "#"` → ошибка;
    нарушение схемы → ошибка; валидная → ок.
  - Готово, когда: тесты зелёные; `npm run build` с испорченной копией `content/en.json` падает с
    понятным сообщением и проходит с исправной (вывод обеих команд в PR).
  - Зависит от: T4

- [ ] T6 — CI в GitHub Actions
  - Файлы: `.github/workflows/ci.yml` — job `dotnet` (setup по `global.json`, restore, build, test,
    `format --verify-no-changes`) и job `frontend` (`npm ci`, lint, format:check, typecheck, test, build);
    триггер — PR и push в main.
  - Хук защиты блокирует правку `.github/workflows/` агентом: текст файла показываю тебе, создаёшь ты
    или явно разрешаешь разово.
  - Тест сначала: n/a (конфигурация); проверка — запуск на PR.
  - Готово, когда: первый PR с этапом 1 — оба job зелёные (ссылка на run). Нужен публичный репо на GitHub
    (`pollezha/aboutMe`) и `gh` (`winget install GitHub.cli`).
  - Зависит от: T3, T5

- [ ] T7 — Команды в CLAUDE.md и README «как запустить»
  - Файлы: `CLAUDE.md` (раздел «Команды»: build, test, test одного, lint/format, запуск AppHost и фронта),
    `README.md` (что это, требования: Docker, .NET 10 SDK, Node LTS; запуск одной командой; ссылки на спеку,
    дизайн, ADR).
  - Тест сначала: n/a; проверка — каждая команда из CLAUDE.md выполнена в `/verify`, вывод приложен.
  - Готово, когда: все команды из README и CLAUDE.md работают на этом окружении.
  - Зависит от: T6

Параллельно: ветка .NET (T1 → T2 → T3) и ветка фронта (T4 → T5) независимы — можно отдать двум сабагентам.
T6 и T7 — после обеих.

## Покрытие: критерии → задачи
| Критерий | Задачи | Как проверяем на шлюзе этапа |
|---|---|---|
| AC7 / TC-10 — битый контент роняет сборку | T5 | тесты валидатора + ручной прогон сборки |
| AC13 (часть) — запуск одной командой | T3, T7 | `dotnet run --project src/AppHost`, gateway healthy |
| FR8 (каркас) — EN/RU | T4 | тест переключения языка |
| FR16 (часть) — CI build/test/format | T6 | зелёный run на PR |
| NFR9 — Nullable, TWAE, format, ESLint/Prettier/vue-tsc, тесты | T1, T4, T6 | 0 предупреждений, линтеры в CI |
| T11 — тесты и CI зелёные | T1–T6 | GitHub Actions |

Остальные AC (AC1–AC6, AC8–AC12, AC14) — этапы 3–7.

## Шлюз этапа 1
`/verify` (все команды из CLAUDE.md с выводом) → `/review` (≤ 3 раунда, 0 blocker/major) → демо тебе →
`/learn` → PR в main, тег `v0.1.0`.

## Отличия от roadmap
- `src/Contracts` не создаём пустым в этапе 1: контракт события — отдельной задачей E4-T1 (правило «смена
  контрактов — отдельными задачами»), пустой проект без кода — шум.
- Шаблон сервиса (E1-T2) = gateway + общие ServiceDefaults; отдельный шаблон `dotnet new` не делаем —
  четыре остальных сервиса появятся в этапе 4 по образцу gateway.

## Риски и откат
- API Aspire или ServiceDefaults для .NET 10 изменились (пакеты переименованы) → T1 начинается со сверки через
  context7; при расхождении правим план, а не подгоняем код под старые примеры.
- Тест AppHost (T3) нестабилен или медленный на Windows → помечаем категорией `Integration`, в CI запускаем
  отдельным шагом; откат — убрать тест из обязательных до этапа 4, оставив ручную проверку.
- `dotnet format` ругается на окончания строк Windows → `.gitattributes` уже ставит LF; при сбое — правило
  `end_of_line` в `.editorconfig` для `*.cs`.
- Хук блокирует `package-lock.json` и `.github/workflows/` для Edit/Write → lock-файл создаёт `npm install`
  (не правится руками), CI-файл создаёшь ты (T6).
- Любая задача ломает сборку → `git revert` её коммита; задачи независимы по коммитам.
