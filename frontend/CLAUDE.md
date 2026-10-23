# frontend/ — Vue 3 + TS + Vite + TresJS

> Подгружается при работе с файлами в `frontend/`. Общие правила — в корневом CLAUDE.md.

## Команды (из frontend/)

```bash
npm run lint && npm run format:check && npm run typecheck && npm test && npm run build  # build валидирует content/*.json
npx vitest run src/__tests__/App.spec.ts -t "English"
npm run gen:theme  # palette.ts + tokens.css из снимка Figma (идемпотентно, CI ловит дрейф)
npm run shots      # сборка + скриншоты первого экрана → docs/design/shots/ (нужен Chrome; CHROME_PATH)
npm run og         # public/og.png 1200×630 + favicon-192/512.png (headless Chrome)
npm run dev        # только фронт на снимке контента
npm run test:lhci  # Lighthouse CI по dist/ (бюджеты в lighthouserc)
npm run perf:scene # время до готовности 3D-сцены
```

Тихо и целиком: `bash scripts/check.sh frontend` из корня.

## Границы слоёв (`eslint.config.js`, хелпер `boundary()`; тест `scripts/__tests__/layer-boundaries.spec.ts`)

- three и `@tresjs/*` — только в `src/scene`; сцену лениво грузит только `src/scene/index.ts`.
- Корень (`App.vue`, `main.ts`, `router.ts`, `head.ts`) берёт из сцены только `./scene`, `./scene/shouldUse3D`, `./scene/useCamera`.
- `fallback2d` ↛ scene, ui; `ui` ↛ scene, fallback2d; оба могут брать content, i18n, stores, theme.
- `stores` ↛ ui, scene, fallback2d, i18n, `.vue`. `i18n` ↛ ui, scene, fallback2d.
- `content`, `theme` — нижний слой: ни на что из перечисленного не ссылаются.
- Новое исключение — отдельной записью `boundary()` с комментарием «почему»; опции из разных записей не сливаются.

## Соглашения

- Цвета, радиусы, отступы — только через токены (`var(--…)`), сгенерированные файлы `src/theme` руками не править.
- Новые сценарии App — в отдельных spec-файлах (`App.<поведение>.spec.ts`), монтировать через `__tests__/appPlugins.ts`.
- Оверлеи/окна — через `history.pushState`, «Назад» закрывает окно.
- После добавления файлов, которые находит `import.meta.glob`, — `npx vitest --clearCache`.
