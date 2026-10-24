# frontend/ — Vue 3 + TS + Vite + TresJS

> Подгружается при работе с файлами в `frontend/`. Общие правила — в корневом CLAUDE.md.

## Команды (из frontend/)

```bash
npm run lint && npm run format:check && npm run typecheck && npm test && npm run build  # build валидирует content/*.json
npx vitest run src/locale/__tests__/App.locale.spec.ts -t "English"
npm run gen:theme  # palette.ts + tokens.css из снимка Figma (идемпотентно, CI ловит дрейф)
npm run shots      # сборка + скриншоты первого экрана → docs/design/shots/ (нужен Chrome; CHROME_PATH)
npm run og         # public/og.png 1200×630 + favicon-192/512.png (headless Chrome)
npm run dev        # только фронт на снимке контента
npm run test:lhci  # Lighthouse CI по dist/ (бюджеты в lighthouserc)
npm run perf:scene # время до готовности 3D-сцены
npm run test:e2e   # Playwright: сборка + preview :4174, 3 проекта (1280, 390, no-webgl); отчёт в playwright-report/
```

Тихо и целиком: `bash scripts/check.sh frontend` из корня.

## Модули (граф — `scripts/module-graph.mjs` → `eslint.config.js`; тест — `scripts/__tests__/layer-boundaries.spec.ts`)

Модуль = `src/<module>/`: `index.ts` (2–4 строки: назначение, зависимости), `*.vue`, `use*.ts`, `__tests__/`.
Чужой модуль — только `../<module>` (index.ts); циклов нет; новая стрелка — строка в графе и здесь (тест сверяет).

| модуль                | может импортировать                        |
| --------------------- | ------------------------------------------ |
| shared/lib, content   | —                                          |
| shared/ui, theme      | shared/lib                                 |
| locale                | content, shared/lib                        |
| route, hero           | content, locale, shared/*                  |
| chapters              | content, locale, route, shared/*           |
| windows               | chapters, content, locale, route, shared/* |
| fallback2d            | content, locale, theme, shared/*           |
| scene (ленивый)       | content, locale, route, theme, shared/lib  |
| mode                  | scene, locale, shared/*                    |
| app                   | всё, кроме scene                           |
| `.` (корень: main.ts) | app, locale, theme                         |

- three/@tresjs — только scene; в scene ходит только mode (app — через него); import() сцены — только scene/index.ts.
- Исключение из фасадов одно: main.ts подключает `theme/*.css` напрямую (`deepAllow` в графе).
- chapters, windows — без import(): окна в main-чанке и предрендере. max-lines 250 (кроме `__tests__` и theme/gen).

## Соглашения

- Цвета, радиусы, отступы — только через токены (`var(--…)`), сгенерированные файлы `src/theme` руками не править.
- Сценарии через App — `<module>/__tests__/App.<module>.spec.ts`, монтировать через `app/__tests__/mountApp.ts`.
- Оверлеи/окна — через `history.pushState`, «Назад» закрывает окно.
- После добавления файлов, которые находит `import.meta.glob`, — `npx vitest --clearCache`.
