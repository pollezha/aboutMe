# Уроки проекта

Пополняется скиллом `/learn`. Формат записи:

```
## YYYY-MM-DD — <коротко>
- Что случилось: <...>
- Причина: <...>
- Правило на будущее: <...>
- Куда закреплено: CLAUDE.md | REVIEW.md | тест | линтер | скилл <имя>
```

Если урок повторился дважды — он должен быть закреплён механически (тест, линтер, хук), а не только текстом.

## 2026-10-20 — этап 1, T1: версии и тестовый раннер .NET 10
- Что случилось: xUnit v3 4.x работает на Microsoft.Testing.Platform; `dotnet test` в .NET 10 SDK падает с
  «Testing with VSTest target is no longer supported», пока MTP не включён. Шаблон Aspire ServiceDefaults
  маппит `/health` и `/alive` только в Development.
- Правило на будущее: `global.json` → `"test": { "runner": "Microsoft.Testing.Platform" }`, без
  Microsoft.NET.Test.Sdk; `using Xunit;` писать явно. Health-эндпоинты маппятся во всех средах (нужны CD и
  мониторингу). Версии пакетов сверять по NuGet/context7, а не по памяти: на 2026-10 Aspire 13.6.1,
  OpenTelemetry 1.20, Microsoft.Extensions.* 10.11, xunit.v3 4.0.2.
- Куда закреплено: global.json, тест DefaultEndpointsTests (Production → 200).

## 2026-10-20 — этап 1, T3: Aspire 13.6 AppHost
- Что случилось: шаблон AppHost включает `AspireUseCliBundle`; сборка сама ставит Aspire CLI (DCP + дашборд)
  через `dnx aspire.cli setup` с лимитом 120 с — на этом канале установка шла 3,5 мин и сборка падала
  ASPIRE009. Aspire.Hosting 13.6.1 транзитивно тянет MessagePack 2.5.302 с уязвимостью (GHSA-qhrr-8q5h-9q3h),
  NU1902 при TreatWarningsAsErrors роняет сборку. Без `launchSettings.json` у сервиса Aspire не видит его
  HTTP-эндпоинт, и `WithHttpHealthCheck` падает.
- Правило на будущее: на новой машине и в CI сначала `dotnet dnx --yes aspire.cli@<версия> -- setup
  --install-path ~/.aspire` (в CI — кэшировать `~/.aspire`). Уязвимые транзитивные пакеты поднимать
  пиннингом в Directory.Packages.props (`CentralPackageTransitivePinningEnabled`), не глушить NU190x.
  У каждого сервиса — `Properties/launchSettings.json` с профилем http.
- Куда закреплено: Directory.Packages.props, тест AppHostTests; шаг установки — в T6 (CI) и README (T7).
- Источник истины версии Aspire — Sdk в `src/AppHost/AppHost.csproj`; CI читает оттуда.

## 2026-10-20 — этап 1, T4: версии фронтенда
- Что случилось: последний TypeScript — 7.x (нативный порт), но typescript-eslint 8.72 требует `typescript <6.1`,
  а совместимость vue-tsc с TS 7 не подтверждена.
- Правило на будущее: держать `typescript ~6.0` до поддержки TS 7 в typescript-eslint и vue-tsc; при обновлении
  сначала `npm view typescript-eslint peerDependencies`.
- Куда закреплено: frontend/package.json (`~6.0.3`).

## 2026-10-21 — ревью этапа 1: хук защиты файлов
- Что случилось: хук проверял только путь у Edit/Write; через Bash/PowerShell (`sed -i`, `cp`, `Set-Content`,
  `cat .env`) защищённые файлы были доступны. Переписывание проверки команд на bash-регэкспах заняло 6 итераций
  и всё равно было хрупким (кавычки в `${var//…}`, `\b`, точки в токенах).
- Правило на будущее: логику хуков писать на node (`.js`), bash — только обёртка; держать матрицу
  «должно блокировать / должно пройти» и гонять её после каждой правки хука.
- Куда закреплено: `.claude/hooks/guard-protected-files.js`, matcher `Bash|PowerShell` в settings.json;
  матрица — scratchpad/hook-test.sh (повторить при следующей правке).
