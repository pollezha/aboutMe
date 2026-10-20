# Claude Code Starter Kit для пет-проектов

Универсальная база: процесс «спека → архитектура → план → TDD → самопроверка → ревью → уроки», оформленный в виде скилов, сабагентов и шаблонов. Собрано по мотивам Superpowers, GSD, Compound Engineering и статьи Anthropic «How the Claude Code team does code review».

## Установка

1. Скопируй содержимое архива в корень нового репозитория (в этом репо уже сделано; этот файл — бывший README кита).
2. Хук адаптирован под Windows: запускается через `bash`, JSON разбирает jq, node или python, пути с `\` нормализуются.
3. Заполни `CLAUDE.md` (стек, команды, соглашения) и `REVIEW.md` (что считается провалом в твоём проекте).
4. Поставь плагины из списка ниже — по необходимости, не все сразу.
5. Запусти `claude` и начни с `/spec <идея фичи>`.

## Что внутри

```
CLAUDE.md                      # контекст проекта для агента (шаблон)
REVIEW.md                      # критерии ревью (шаблон)
.claude/
  settings.json                # разрешения + хук защиты файлов
  hooks/guard-protected-files.sh
  skills/
    spec/          /spec          интервью → проверяемая спецификация
    architecture/  /architecture  дизайн, сквозные вопросы, ADR
    plan/          /plan          атомарные задачи, вертикальные срезы
    implement/     /implement     одна задача: TDD → коммит
    verify/        /verify        доказательства работы (сборка, тесты, запуск, AC)
    review/        /review        параллельный поиск → перепроверка → отчёт, ≤3 раундов
    debug/         /debug         воспроизвести → гипотезы → фикс с регрессионным тестом
    learn/         /learn         уроки → тесты/линтер/REVIEW.md/CLAUDE.md
  agents/
    reviewer.md                # ревьюер в чистом контексте
    verifier.md                # отсеивает ложные срабатывания
docs/
  spec/_template.md
  adr/0000-template.md
  plans/_template.md
  learnings.md
.github/pull_request_template.md   # проверка, риск, откат
```

## Процесс

| Шаг | Команда | Выход | Когда пропускать |
|---|---|---|---|
| 1 | `/spec` | docs/spec/<feature>.md | однострочные правки |
| 2 | `/architecture` | ADR + design | решение не меняет структуру/контракты |
| 3 | `/plan` | docs/plans/<feature>.md | задача из 1 шага |
| 4 | `/implement T1` … | коммит на задачу | — |
| 5 | `/verify` | отчёт PASS/FAIL | никогда |
| 6 | `/review` | отчёт по severity | тривиальные правки документации |
| 7 | `/learn` | обновлённые правила | если уроков нет |

Ключевые принципы:
- **Свежий контекст.** Длинная сессия деградирует. Между задачами — `/clear`; состояние живёт в файлах `docs/`, а не в чате.
- **Доказательства вместо «готово».** Без вывода `/verify` задача не закрыта.
- **Ревью сходится.** Максимум 3 раунда, со 2-го — только новый дифф, без повторов.
- **Человек решает рискованное.** Миграции, деньги, авторизация, CI — смотришь сам, AI-одобрение не считается.
- **Компаундинг.** Повторившаяся ошибка закрепляется механически: тест, линтер, хук.

## Рекомендуемые плагины

Официальный маркетплейс: `/plugin install <имя>@claude-plugins-official`

| Зачем | Плагин | Комментарий |
|---|---|---|
| Документация библиотек | `context7` | актуальные API вместо галлюцинаций |
| Ревью | `pr-review-toolkit` или `code-review` | дополняет `/review` из набора |
| Безопасность | `security-guidance` | предупреждения при рискованных правках |
| Git | `commit-commands` | коммит/пуш/PR одной командой |
| UI-тесты | `playwright` | для `/verify` фронтенда |
| Фронтенд | `frontend-design` | UI не «как у всех ИИ» |
| Поддержка CLAUDE.md | `claude-md-management` | |
| Свои скилы | `skill-creator` | создание и тестирование скилов |
| Хуки | `hookify` | хуки из markdown-описаний |

Под стек (ставь нужное):
- LSP своего языка: `typescript-lsp`, `pyright-lsp`, `gopls-lsp`, … (`csharp-lsp` — проверь наличие в `/plugin`).
- .NET: `/plugin marketplace add https://github.com/Aaronontheweb/dotnet-skills` → `/plugin install dotnet-skills` (EF Core, Testcontainers, concurrency, Aspire, slopwatch).

Утилиты: `npx ccusage` — расход токенов.

### Альтернатива — готовый фреймворк целиком
Если не хочется поддерживать свои скилы, вместо `.claude/skills` этого набора можно взять один из фреймворков (не смешивать!):
- **Superpowers** — `/plugin install superpowers@claude-plugins-official` — самый популярный, жёсткий TDD.
- **GSD** — `npx gsd-build@latest install --claude --local` — для больших проектов и длинных сессий.
- **Compound Engineering** (EveryInc) — цикл plan → work → review → compound.

Свои скилы из этого набора можно оставить для `REVIEW.md`-ревью и `/learn` — они не конфликтуют по именам, но следи, чтобы описания не перекрывались.

## Источники
- How the Claude Code team does code review — https://claude.dev/blog/solving-code-review-at-anthropic/
- obra/superpowers, gsd-build/get-shit-done, EveryInc/compound-engineering-plugin, Aaronontheweb/dotnet-skills
