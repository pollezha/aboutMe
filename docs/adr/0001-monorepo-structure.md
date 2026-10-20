# ADR-0001: Структура монорепозитория — фронт, сервисы и общие проекты раздельно

Статус: accepted · Дата: 2026-10-20

## Контекст
В одном репозитории живут Vue-фронтенд, 5 сервисов на .NET 10 (gateway, content-api, events-api, projector,
live-hub), общие проекты (Contracts, ServiceDefaults, Aspire AppHost), тесты и конфигурация деплоя
(Compose, Caddy, OTel Collector, Grafana). Репозиторий публичный: техлид должен за 5 минут понять
устройство по дереву папок и README (docs/spec/portfolio-mvp.md, G6). Starter kit в CLAUDE.md предлагал
общие `src/` и `tests/` — шаблон по умолчанию, без учёта двух экосистем (npm и dotnet) в одном репо.

## Рассмотренные варианты
| Вариант | Плюсы | Минусы | Стоимость изменения потом |
|---|---|---|---|
| A. Как в plan.md: `/frontend`, `/services/<svc>`, `/src/{Contracts,ServiceDefaults,AppHost}`, `/tests`, `/deploy` | Дерево повторяет архитектуру; фронт и .NET не смешиваются; у каждого сервиса своя папка и Dockerfile; CI легко фильтровать по путям | Два «корня» кода (`/services` и `/src`) — нужно правило, что куда | Средняя: перенос папок ломает пути в sln, Dockerfile, CI |
| B. Как в starter kit: всё в `src/`, тесты в `tests/` | Проще, привычно для одного .NET-решения | Фронт с node_modules рядом с C#-проектами; сервисы и общие библиотеки не различимы по пути | Та же |

## Решение
Вариант A (выбран пользователем): дерево каталогов повторяет архитектуру, поэтому публичный репо читается
без README. Правило: `/services` — развёртываемые процессы, `/src` — неразвёртываемые общие проекты и AppHost,
`/tests` — тесты .NET (`<Project>.Tests`), тесты фронта живут в `/frontend`.

```
/frontend            Vue 3 + TS + Vite + TresJS (свои тесты: Vitest, Playwright)
/services/<svc>      gateway, content-api, events-api, projector, live-hub — по Dockerfile на сервис
/src/Contracts       схемы событий и DTO
/src/ServiceDefaults OpenTelemetry, health, resilience
/src/AppHost         Aspire для локального запуска
/tests               unit + integration (.NET, Testcontainers)
/deploy              compose, Caddy, OTel Collector, Grafana-провиженинг
/content             контент EN/RU в JSON (ADR-0004)
/docs                spec, adr, plans, concept, learnings
```

## Последствия
- Становится проще: найти код сервиса; собирать образы и запускать CI по изменённым путям.
- Становится сложнее: держать один `.sln` и `Directory.Build.props` в корне, указывающие на две папки.
- Сигнал пересмотреть: сервисов станет меньше двух (projector + live-hub объединены и т. п.) — тогда
  `/services` можно слить с `/src`.
