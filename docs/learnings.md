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
