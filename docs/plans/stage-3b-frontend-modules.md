# План: этап 3b «Фронтенд по модулям» — перестройка `frontend/src` без изменения поведения

Спека: нет (рефакторинг, поведение не меняется) · ADR: 0007 (модули по областям), опирается на 0003, 0005.
Заменяет пункт D5 из `docs/plans/agent-dx.md` (тонкий `App.vue`, разбивка `App.spec.ts`): он закрывается
задачами M3–M4 и M10–M17.

Статус: **approved 2026-10-24**. Новых зависимостей нет. Старт — после слияния T12b этапа 3 (кроме M1, M2).

Цель: одна предметная область — одна папка `src/<module>/` с публичным `index.ts`, своими сторами,
компонентами и тестами; `App.vue` — композиция модулей ≤ 250 строк; граф модулей проверяют `boundary()` и
тест границ. После каждой задачи сборка, lint, typecheck, все vitest и e2e зелёные, число тестов не меньше
базовой линии.

## Базовая линия (снимает оркестратор перед M1, пишет сюда)
| Что | Как | Значение | После M18 |
|---|---|---|---|
| vitest | `npx vitest run` → строка `Tests` | 696 (после T12b) | 783 (70 файлов) |
| e2e | `npx playwright test --list` → последняя строка | 42 | 42 |
| `expect(` в спеках | `grep -r "expect(" src scripts --include=*.spec.ts | wc -l` | 1038 | 1203 |
| size-limit | `npm run build && npm run size` | 86.29 КБ gzip / 835.86 КБ / 114.39 КБ | 87.22 КБ gzip / 835.87 КБ / 114.39 КБ |
| скриншоты | `npm run shots` → `docs/design/shots/` | снять (сравнение после M14–M17) | сняты в M14–M17 |

Правило каждой задачи: число vitest ≥ базовой линии + добавленные тесты; число `expect(` в перенесённых спеках
не меньше, чем было; e2e = 42. При переносе тестов меняются только импорты и имя стора, тексты `it()` и
проверки — нет (ревью: `git diff -M --color-moved=dimmed-zebra`).

## Целевое дерево (файл → новое место)
Модули лежат прямо в `src/`: `scene`, `content`, `theme`, `fallback2d` остаются на своих путях (на них
ссылаются `scripts/*.mjs`, `vite.config.ts`, `bundle.spec`), переезжают `ui/`, `stores/`, `i18n/` и корень.

```
frontend/src/
  main.ts                    на месте (вход index.html и vite-ssg; правит T12b); импортирует ./app
  env.d.ts                   на месте
  __tests__/                 только глобальные инварианты: bundle, ssr, seo-assets, tokens-only
  app/        index.ts, App.vue, TopBar.vue, useLayout.ts, head.ts, __tests__/{mountApp,appPlugins,head.spec,App.app.spec}
  shared/lib/ index.ts, useBreakpoint.ts, storage.ts
  shared/ui/  index.ts, BaseButton, IconButton, Icon, icon-registry.ts, icons/*.svg, Dialog, StatusPill, ChapterTag, MetricCard
  content/    index.ts + как сейчас (types, bundles, chapters, experience, format, buildTime)
  theme/      index.ts + как сейчас (palette, tokens.css, pinInk, pins.css, fonts/typography/base.css, boot, contrast) + useThemeStore.ts, useTheme.ts
  locale/     index.ts, i18n.ts, en.json, ru.json, routes.ts, useLangStore.ts, useRouteLang.ts
  route/      index.ts, useRouteStore.ts, RouteBar.vue, BottomBar.vue, RouteStop.vue
  hero/       index.ts, HeroCard.vue, useHero.ts
  chapters/   index.ts, registry.ts, <8>Window.vue, blocks/*.vue
  windows/    index.ts, WindowHost.vue, ChapterWindow.vue, ProofLinks.vue, PrerenderedChapters.vue, useWindowHistory.ts, useChapterWindow.ts
  fallback2d/ index.ts + как сейчас (StaticMap.vue, render.ts)
  scene/      как сейчас (ленивый чанк), без shouldUse3D.ts; index.ts реэкспортирует mapRotation
  mode/       index.ts, useModeStore.ts, shouldUse3D.ts, useViewMode.ts, useSceneLoader.ts, SceneHost.vue, SceneLoading.vue, SceneFallbackBanner.vue
```

| Сейчас | Станет | Задача |
|---|---|---|
| `src/App.vue` | `src/app/App.vue`; логика — в модули (см. ниже) | M10–M17 |
| `src/head.ts` | `src/app/head.ts` | M17 |
| `src/router.ts` | `src/locale/routes.ts` | M11 |
| `src/main.ts`, `src/env.d.ts` | на месте | — |
| `src/__tests__/App.spec.ts` (45 тестов) | `App.locale` (7), `App.theme` (3), `App.layout` (5), `App.windows-nav` (13), `App.mode` (12), `App.scene-loading` (5) — см. M3/M4 | M3, M4 |
| `src/__tests__/appPlugins.ts` | `src/app/__tests__/appPlugins.ts` + новый `mountApp.ts` (общая обвязка из шапки App.spec) | M3 |
| `src/__tests__/App.techstack.spec.ts` | `src/chapters/__tests__/` | M8 |
| `src/__tests__/App.windows.spec.ts` | `src/windows/__tests__/` | M16 |
| `src/__tests__/App.visited.spec.ts` | `src/route/__tests__/` | M12 |
| `src/__tests__/head.spec.ts` | `src/app/__tests__/` | M17 |
| `src/__tests__/{bundle,ssr,seo-assets}.spec.ts` | на месте | — |
| `src/ui/__tests__/tokens-only.spec.ts` | `src/__tests__/tokens-only.spec.ts` | M2 |
| `src/stores/ui.ts` | `theme/useThemeStore.ts`, `locale/useLangStore.ts`, `route/useRouteStore.ts`, `mode/useModeStore.ts`; `load/save` → `shared/lib/storage.ts` | M5, M10–M13 |
| `src/stores/__tests__/ui.spec.ts` | по частям в `__tests__/` этих четырёх модулей (`*Store.spec.ts`) | M10–M13 |
| `src/i18n/index.ts`, `en.json`, `ru.json` | `src/locale/i18n.ts`, `src/locale/*.json` | M11 |
| `src/i18n/__tests__/messages.spec.ts` | `src/locale/__tests__/` | M11 |
| `src/scene/shouldUse3D.ts` + spec | `src/mode/` | M13 |
| `src/scene/**` прочее | на месте | — |
| `src/content/**`, `src/theme/**`, `src/fallback2d/**` | на месте + `index.ts` | M5, M6 |
| `src/ui/{BaseButton,IconButton,Icon,Dialog,StatusPill,ChapterTag,MetricCard}.vue`, `icon-registry.ts`, `icons/` + 7 спеков | `src/shared/ui/` | M7 |
| `src/ui/useBreakpoint.ts` | `src/shared/lib/` | M7 |
| `src/ui/HeroCard.vue` + spec | `src/hero/` | M9 |
| `src/ui/{BottomBar,RouteStop}.vue` + 2 спека | `src/route/` | M9 |
| `src/ui/{SceneLoading,SceneFallbackBanner}.vue` | `src/mode/` | M9 |
| `src/ui/ChapterWindow.vue` + spec | `src/windows/` | M8 |
| `src/ui/windows/<8>Window.vue` | `src/chapters/` | M8 |
| `src/ui/windows/index.ts` | `src/chapters/registry.ts` (реестр), `chapters/index.ts` — публичный API | M8 |
| `src/ui/windows/blocks/*` кроме ProofLinks | `src/chapters/blocks/` | M8 |
| `src/ui/windows/blocks/ProofLinks.vue` | `src/windows/` | M8 |
| `src/ui/windows/__tests__/{windows,windows-05-08,techstack,blocks}.spec.ts` | `src/chapters/__tests__/`; `describe('ProofLinks')` → `src/windows/__tests__/ProofLinks.spec.ts` | M8 |

Логика `App.vue` → модули:
| Кусок `App.vue` | Куда |
|---|---|
| язык ↔ маршрут (`routeLang`, `router.push`), `useLocaleSync` | `locale/useRouteLang.ts` (M11) |
| `?theme=`, `applyTheme`-watch, `themeLabel`, `NEXT_THEME` | `theme/useTheme.ts` (M10) |
| `stops`, `barProfile`, подписи бара, `showLang` | `route/RouteBar.vue` (M12) |
| `?mode=`, `isWide`, `use3D`, `detectMode`, `canSwitchMode`, `switchMode` | `mode/useViewMode.ts` (M13) |
| `startScene`/`failScene`/`onSceneReady`/`continueWithout3D`, scene-layer, заглушка, SceneLoading | `mode/useSceneLoader.ts`, `mode/SceneHost.vue` (M14) |
| `profile`, `highlights`, `links` | `hero/useHero.ts` (M15) |
| `windowChapter`, `windowText`, `windowEyebrow`, `prev/nextLink`, `<ChapterWindow>` | `windows/useChapterWindow.ts`, `WindowHost.vue` (M16) |
| `ownsHistoryEntry`, `urlWith`, `onWindowOpen`, hash-watch, `syncFromLocation`, popstate/hashchange | `windows/useWindowHistory.ts` (M16) |
| `<section id="chapters" hidden>` (предрендер) | `windows/PrerenderedChapters.vue` (M16) |
| `layout`, `heroVariant`, `barVariant`, `mapVariant`, `?shot=`, верхние контролы, `useSiteHead` | `app/useLayout.ts`, `app/TopBar.vue`, `app/App.vue` (M17) |

## Граф зависимостей
```
                         app ──────────────────────────────────────────────┐
     ┌────────┬─────────┬──┴─────┬──────────┬────────────┐                 │
   hero     route ◄── chapters ◄── windows  fallback2d    mode ──► scene (ленивый)
     │        │          │          │          │            │        │  │  │  │
     └──► locale ◄───────┴──────────┘          ├──► theme   │        │  │  │  └─► route
           │                                   │            │        │  │  └────► theme
           ▼                                   │            │        │  └───────► locale
        content ◄──────────────────────────────┴────────────┼────────┘
                                 shared/ui ──► shared/lib ◄─┘  (shared/* доступны всем, см. таблицу)
```
Точный список стрелок — таблица в ADR-0007 и `scripts/module-graph.mjs`. Стрелки только вниз: `content` и
`shared/lib` ни от кого; никто не импортирует `app`; `scene` импортирует только `mode`.

## Правила границ (как выражаются)
- `frontend/scripts/module-graph.mjs` (новый, без зависимостей) экспортирует `MODULES` — объект
  `{ [module]: { deps: string[], facade: boolean, lazy?: true, legacy?: true } }` — и функцию
  `moduleBoundaries(modules)`, которая возвращает записи `boundary()` по одной на модуль (опции из разных
  записей не сливаются — поэтому всё для модуля собирается в одну запись):
  - `no3d` для всех, кроме `scene`;
  - модуль M не из `deps` → бан `^(\.\.?/)+M(/|$)` «модуль M отсюда недоступен (граф ADR-0007)»;
  - модуль из `deps` с `facade: true` → бан глубокого импорта `^(\.\.?/)+M/.+` «только через M/index.ts»;
  - вложенные ключи (`shared/ui` ↔ `shared/lib`) — ещё и короткая форма `^\.\./lib(/|$)` из `shared/ui`;
  - `no-restricted-syntax`: `import()` three/TresJS и сцены — как сейчас; для `chapters`, `windows` — любой
    `ImportExpression` запрещён (предрендер); `scene/index.ts` — отдельная запись: всё, что у `scene`, плюс
    бан статического `\.vue$`.
- Переходные записи `legacy: true` (`ui`, `stores`, `i18n`, корень `src/*.{ts,vue}`) сохраняют сегодняшние
  запреты дословно и уходят по мере переезда; `facade` включается, когда у модуля появляется `index.ts` (M5, M6).
- `max-lines`: `['error', { max: 250, skipBlankLines: true, skipComments: true }]` для `src/**/*.{ts,vue}`,
  `ignores`: `src/**/__tests__/**`, `src/theme/palette.ts`, `src/theme/pinInk.ts`, временно `src/App.vue`
  (до M17). Если правило считает весь SFC вместе со `<style>` — порог тот же (проверить фикстурой в M1);
  запасной путь — `vue/max-lines-per-block` из уже установленного `eslint-plugin-vue`.
- Тест `scripts/__tests__/layer-boundaries.spec.ts`: синтетический граф через
  `new ESLint({ overrideConfigFile: true, overrideConfig: [...] })` (глубокий импорт → ошибка; через index →
  чисто; стрелки нет → ошибка; `import()` в `chapters` → ошибка); реальный `MODULES` ацикличен; каждая папка
  `src/*` и `src/shared/*` (кроме `__tests__`) — ключ графа; имена внутренних подпапок не совпадают с именами
  модулей; существующие 7 проверок остаются. С M18: в `MODULES` нет `legacy`, у всех `facade: true`, таблица
  «модуль → может импортировать» в `frontend/CLAUDE.md` совпадает с графом.

## Задачи
Каждая задача: укладывается в половину контекста, даёт рабочее состояние, один коммит, дифф ≤ ~300 строк
(переименования `git mv` не считаются). После переноса файлов — `npx vitest --clearCache`. Проверка —
`bash scripts/check.sh frontend` + `npm run test:e2e`; счётчики — по базовой линии.

- [x] M1 — Граф модулей, генератор границ, `max-lines`
  - Файлы: `frontend/scripts/module-graph.mjs` (новый), `frontend/eslint.config.js` (записи слоёв →
    `...moduleBoundaries(MODULES)`, `max-lines`), `frontend/scripts/__tests__/layer-boundaries.spec.ts`.
  - Тест сначала: синтетический граф — глубокий импорт `../route/useRouteStore` из модуля с `deps: ['route']`
    даёт 1 ошибку, `../route` — 0; цикл `a → b → a` роняет проверку ацикличности; папка `src/foo/` без ключа
    в графе роняет тест регистрации (фикстура — список папок, не ФС); файл в 251 строку — ошибка `max-lines`.
  - Готово, когда: `npm run lint` зелёный на текущем коде без правок `src/`; старые 7 проверок проходят
    без изменений; целевые модули есть в графе с `facade: false`.
  - Зависит от: — (идёт параллельно с T12b: не трогает его файлы).

- [x] M2 — Глобальные инварианты не зависят от раскладки
  - Файлы: `src/ui/__tests__/tokens-only.spec.ts` → `src/__tests__/tokens-only.spec.ts` (glob
    `../**/*.vue` без `scene/**` и `__tests__`), `src/i18n/__tests__/messages.spec.ts` (glob всех `.vue`
    кроме `scene/**`, плюс `scene/Labels.vue`), `src/ui/windows/__tests__/windows.spec.ts` (glob сырых исходников).
  - Тест сначала: в каждый glob-спек — проверка «нашли не меньше N файлов» (N — сегодняшнее число); после
    расширения glob набор файлов тот же, что сейчас, — проверка проходит.
  - Готово, когда: переезд файлов в следующих задачах не может молча сузить покрытие (glob пустеет → тест красный).
  - Зависит от: — (параллельно с T12b и M1).

- [x] M3 — `App.spec.ts`: общая обвязка и первые три спека
  - Файлы: `src/app/__tests__/mountApp.ts` (шапка App.spec: моки matchMedia/WebGL, монтирование),
    `src/__tests__/appPlugins.ts` → `src/app/__tests__/`, новые `src/__tests__/App.locale.spec.ts` (7 тестов,
    стр. 110–216), `App.theme.spec.ts` (3: 520–548), `App.layout.spec.ts` (5: 225–257, 473–498); из
    `App.spec.ts` они вырезаются. Импорты остальных App-спеков на `appPlugins` правятся.
  - Тест сначала: — (перенос); счётчик vitest и `expect(` до/после совпадают.
  - Готово, когда: каждый новый спек ≤ 250 строк; `App.vue` не тронут.
  - Зависит от: T12b (он может править сценарии загрузки сцены в App.spec).

- [x] M4 — `App.spec.ts`: остальные спеки, файл удалён
  - Файлы: `src/__tests__/App.windows-nav.spec.ts` (13: 258–382 история/prev-next/фокус, 570–616 deep links),
    `App.mode.spec.ts` (12: 383–472 выбор 2D/3D и `?shot`, 499–519, 549–569 поворот, 617–627 пауза),
    `App.scene-loading.spec.ts` (5: 628–709); `App.spec.ts` удалён.
  - Тест сначала: —; счётчики совпадают; `App.windows-nav` > 250 строк → делится на `App.history` и `App.deeplink`.
  - Готово, когда: в `src/__tests__/` нет файла > 250 строк.
  - Зависит от: M3.

- [x] M5 — Фасады нижних модулей: `shared/lib`, `shared/ui`, `content`, `theme`
  - Файлы: `src/shared/lib/{index.ts,storage.ts}` (`load/save/loadSession/saveSession` из `stores/ui.ts`,
    `ui.ts` их импортирует), `src/shared/lib/index.ts` реэкспортирует `../../ui/useBreakpoint`,
    `src/shared/ui/index.ts` (реэкспорт 9 компонентов и `IconName` из `../../ui/*`), `src/content/index.ts`,
    `src/theme/index.ts` (палитра, `contrast`, типы; CSS — нет). Потребители вне модуля переходят на `../<module>`:
    `App.vue`, `head.ts`, `stores/ui.ts`, `ui/**`, `scene/**`, `fallback2d/**`, `i18n/index.ts`. В графе
    `facade: true` у этих четырёх; исключение для `main.ts`: `^\./theme/[^/]+\.css$`.
  - Тест сначала: `layer-boundaries`: `import { palette } from '../theme/palette'` из `src/scene/X.ts` — ошибка,
    `from '../theme'` — чисто; `storage.spec.ts` (недоступное хранилище → `null`, без исключения).
  - Готово, когда: `grep -rE "from '(\.\./)+(content|theme)/" src --include=*.vue --include=*.ts | grep -v __tests__`
    пусто (кроме `index.ts` самих модулей); size-limit main не вырос > 1 КБ.
  - Зависит от: M1, T12b.

- [x] M6 — Фасады верхних модулей: `locale`, `route`, `hero`, `chapters`, `windows`, `mode`, `fallback2d`, `scene`
  - Файлы: `index.ts` с шапкой в `src/{locale,route,hero,chapters,windows,mode,fallback2d}/` — реэкспорт из
    старых мест (`../i18n`, `../router`, `../ui/BottomBar.vue`, `../ui/windows` …); `src/scene/index.ts` —
    реэкспорт `mapRotation`, `isRotateHotkey`, `shouldUse3D`, `detectWebGL2`, `MIN_3D_WIDTH` (лёгкие модули без
    three); `mode/index.ts` реэкспортирует их из `../scene`. `App.vue`, `head.ts`, `main.ts`, `router.ts`
    переходят на фасады; запись корня в графе: сцена — только через `mode`.
  - Тест сначала: `layer-boundaries`: `import Scene from '../scene/Scene.vue'` из `src/mode/X.ts` — ошибка;
    `import { mapRotation } from '../scene'` из `src/app/X.ts` — ошибка (только `mode`); `bundle.spec` (three
    не в main, `Scene.vue` — динамический импорт) зелёный без правок.
  - Готово, когда: в `App.vue` нет импорта глубже `./<module>`; у всех модулей `facade: true`.
  - Зависит от: M5.

- [x] M7 — Переезд `shared/ui` и `shared/lib`  *(параллельно с M8, M9, M10)*
  - Файлы: `git mv` из таблицы (9 компонентов, `icon-registry.ts`, `icons/`, `useBreakpoint.ts`, 7 спеков);
    `shared/*/index.ts` — пути на свои файлы; внутренние импорты перенесённых файлов.
  - Тест сначала: — (перенос); спеки компонентов переехали и зелёные; `Icon.spec` находит все 22 SVG
    (`import.meta.glob('./icons/*.svg')` переехал вместе с папкой).
  - Готово, когда: в `src/ui/` нет этих файлов; потребители не менялись (дифф вне `src/ui`, `src/shared` пуст).
  - Зависит от: M6.

- [x] M8 — Переезд `chapters` и каркаса `windows`  *(параллельно с M7, M9, M10)*
  - Файлы: `git mv` `src/ui/windows/**` → `src/chapters/` (реестр → `registry.ts`), `ProofLinks.vue`,
    `ui/ChapterWindow.vue` + spec → `src/windows/`; `describe('ProofLinks')` из `blocks.spec` →
    `windows/__tests__/ProofLinks.spec.ts`; `App.techstack.spec` → `chapters/__tests__/`; `chapters/index.ts`,
    `windows/index.ts`. Импорты окон `../../shared/ui` → `../shared/ui`.
  - Тест сначала: — ; glob `windows.spec` (M2) находит прежнее число файлов; `ssr.spec` — текст всех 8 глав в HTML.
  - Готово, когда: `src/ui/windows/` и `src/ui/ChapterWindow.vue` удалены; `App.vue` не тронут.
  - Зависит от: M6.

- [x] M9 — Переезд UI `hero`, `route`, `mode`  *(параллельно с M7, M8, M10)*
  - Файлы: `git mv` `HeroCard.vue` → `hero/`, `BottomBar.vue`, `RouteStop.vue` → `route/`,
    `SceneLoading.vue`, `SceneFallbackBanner.vue` → `mode/` (+ спеки); их `index.ts`.
  - Тест сначала: — ; спеки переехали и зелёные.
  - Готово, когда: эти файлы не в `src/ui/`; `App.vue` не тронут.
  - Зависит от: M6.

- [x] M10 — Стор и логика темы в `theme`  *(параллельно с M7–M9: файлы не пересекаются)*
  - Файлы: `src/theme/useThemeStore.ts` (theme, setTheme, previewTheme, cycleTheme, applyTheme — из `ui.ts`),
    `src/theme/useTheme.ts` (`?theme=`, watch → `applyTheme`, `label` с `NEXT_THEME`), `theme/index.ts`;
    `stores/ui.ts` теряет тему; потребители: `App.vue`, `scene/Scene.vue`, `scene/SceneContent.vue`,
    `fallback2d/StaticMap.vue`, комментарии `theme/boot.ts` и `index.html`. Тесты: тема из `ui.spec` →
    `theme/__tests__/useThemeStore.spec.ts`; `App.theme.spec` → `theme/__tests__/`; `materials.spec`,
    `StaticMap.spec` — импорт типа/стора.
  - Тест сначала: `useTheme.spec.ts`: `?theme=night` показывает ночь и не пишет `aboutme.theme`; падает до
    появления `useTheme`.
  - Готово, когда: в `App.vue` нет кода темы, кроме вызова `useTheme()`; ключ `aboutme.theme` прежний.
  - Зависит от: M3, M6.

- [x] M11 — `locale`: i18n, язык, маршруты
  - Файлы: `git mv src/i18n → src/locale` (`index.ts` → `i18n.ts`), `src/router.ts` → `locale/routes.ts`,
    `locale/useLangStore.ts` (lang, setLang, syncLang, toggleLang), `locale/useRouteLang.ts` (язык ↔ маршрут
    из `App.vue` + `useLocaleSync`); потребители: `main.ts`, `App.vue`, `head.ts`, `scene/Labels.vue`,
    `fallback2d/StaticMap.vue`, `app/__tests__/appPlugins.ts`, `ssr.spec`, `seo-assets.spec`; `App.locale.spec`
    и часть `ui.spec` → `locale/__tests__/`; убрать `legacy` записи `i18n` и корня `router.ts`.
  - Тест сначала: `useRouteLang.spec.ts`: смена языка на `/` с открытым `#contact` ведёт на `/ru/#contact`
    без перезагрузки; маршрут `/ru/` не пишет `aboutme.lang`.
  - Готово, когда: `src/i18n/`, `src/router.ts` удалены; в `App.vue` один вызов `useRouteLang()`.
  - Зависит от: M10.

- [x] M12 — `route`: стор маршрута и `RouteBar`
  - Файлы: `route/useRouteStore.ts` (activeStop, openWindow, visitedStops, motionPaused, openChapter,
    closeWindow, toggleMotion), `route/RouteBar.vue` (BottomBar + `stops`, `barProfile`, подписи; события
    темы/языка наружу); потребители стора: `App.vue`, `scene/{Labels,Scene,SceneContent,Truck}.vue`,
    `chapters/{ContactWindow,SummaryWindow}.vue`, `windows/ProofLinks.vue` и их спеки; `App.visited.spec` и
    часть `ui.spec` → `route/__tests__/`. Если дифф > 300 строк — `RouteBar` отдельным коммитом M12b.
  - Тест сначала: `RouteBar.spec.ts`: активная остановка — `active`, посещённая неактивная — `visited`
    (сейчас это считает `App.vue`; тест падает до `RouteBar`).
  - Готово, когда: `ui.spec` без маршрута; ключ `aboutme.visited` в sessionStorage прежний.
  - Зависит от: M8, M9, M11.

- [x] M13 — `mode`: стор режима и выбор 3D/2D; `stores/` удалён
  - Файлы: `mode/useModeStore.ts` (mode, userChoice, sceneState и их экшены), `git mv scene/shouldUse3D.ts`
    (+ spec) → `mode/`, `mode/useViewMode.ts` (`?mode=`, `isWide`, `use3D`, `detectMode`, `canSwitchMode`,
    `switchMode`); `scene/index.ts` больше не реэкспортирует `shouldUse3D`; `App.mode.spec` и остаток `ui.spec`
    → `mode/__tests__/`; `src/stores/` удалён, `legacy: stores` убрана.
  - Тест сначала: `useViewMode.spec.ts`: `?mode=3d` при сохранённом 2D даёт 3D на этот визит и не меняет
    `aboutme.sceneChoice`.
  - Готово, когда: `src/stores/` нет; `grep -r useUiStore src` пусто.
  - Зависит от: M12.

- [x] M14 — `mode`: загрузка сцены и `SceneHost`
  - Файлы: `mode/useSceneLoader.ts` (start/fail/ready/continue, таймаут `SCENE_TIMEOUT_MS`, `scene_ready`),
    `mode/SceneHost.vue` (scene-layer, заглушка, `SceneLoading`; стили из `App.vue`); `App.scene-loading.spec`
    → `mode/__tests__/`. Логику берём из `App.vue` после T12b (он менял момент старта сцены).
  - Тест сначала: `useSceneLoader.spec.ts` на фейковых таймерах: нет `ready` за 8 с → `failed` и 2D; повторный
    `start` во время загрузки не создаёт второй импорт.
  - Готово, когда: `App.vue` не импортирует `loadSceneWhenIdle`; e2e `no-webgl` и first-screen зелёные;
    `npm run shots` без видимой разницы с базовой линией.
  - Зависит от: M13.

- [x] M15 — `hero`: данные карточки
  - Файлы: `hero/useHero.ts` (`profile`, `highlights`, `links` из контента текущего языка), `hero/index.ts`;
    `App.vue` передаёт только `variant`. Класс `.app__hero` остаётся на корне `HeroCard` (селектор e2e).
  - Тест сначала: `useHero.spec.ts`: на RU-бандле ссылка CV ведёт на RU-PDF; 3 метрики = `resolveHighlights`.
  - Готово, когда: в `App.vue` нет вычислений Hero.
  - Зависит от: M14.

- [x] M16 — `windows`: хост окна, история и предрендер текста глав
  - Файлы: `windows/useChapterWindow.ts` (текст, eyebrow «Stop N of 6», prev/next), `windows/useWindowHistory.ts`
    (pushState/replaceState/back, popstate/hashchange), `windows/WindowHost.vue`, `windows/PrerenderedChapters.vue`;
    `App.windows.spec`, `App.windows-nav` (или `App.history`/`App.deeplink`) → `windows/__tests__/`.
  - Тест сначала: `useWindowHistory.spec.ts`: prev/next заменяет запись истории, а не добавляет (сейчас
    проверяется только через App).
  - Готово, когда: в `App.vue` нет `history.`/`hashchange`; `ssr.spec` и e2e `windows`, `keyboard` зелёные.
  - Зависит от: M15.

- [x] M17 — Оболочка `app`: тонкий `App.vue`
  - Файлы: `git mv src/App.vue src/app/App.vue`, `src/head.ts` → `src/app/head.ts` (+ `head.spec`),
    `app/TopBar.vue` (поворот, пауза, режим, тема, язык — композиция кнопок модулей), `app/useLayout.ts`
    (overlay/stacked, варианты Hero/бара/карты), `app/index.ts`; `main.ts` → `import App from './app'`;
    остаток App-сценариев (`?shot=island`, раскладка) → `app/__tests__/App.app.spec.ts`; снять исключение
    `max-lines` для `App.vue`; поправить glob `tokens-only`/`messages` при необходимости.
  - Тест сначала: `useLayout.spec.ts`: 3D на laptop → `overlay`, 2D на desktop → `stacked`.
  - Готово, когда: `App.vue` ≤ 250 строк по `max-lines` и без собственной логики (только композиция и
    раскладка); size-limit main в пределах ±1 КБ от базовой линии, `app-*.js` найден; e2e 42/42.
  - Зависит от: M16.

- [ ] M18 — Документы и закрепление правил
  - Файлы: `frontend/CLAUDE.md` (раздел границ → таблица модулей, см. ниже), `docs/design/architecture.md` §4
    «Слои» → «Модули», `docs/adr/0007` → `accepted`, `docs/plans/agent-dx.md` (D5 — закрыт этим планом),
    `scripts/module-graph.mjs` (без `legacy`), `layer-boundaries.spec.ts` (нет `legacy`, все `facade`;
    таблица в `frontend/CLAUDE.md` = граф), `docs/learnings.md`.
  - Тест сначала: тест сверки таблицы падает на текущем `frontend/CLAUDE.md`.
  - Готово, когда: `bash scripts/check.sh all` зелёный; базовая линия: vitest ≥ 686 + новые, e2e 42.
  - Зависит от: M17.

## Параллельность
- Волна 0 (во время T12b): M1 ‖ M2 — трогают только `eslint.config.js`, `scripts/`, три glob-спека.
- Волна 1 (после T12b): M3 → M4 (только спеки App) ‖ M5 → M6 (исходники и фасады).
- Волна 2 (после M6, M3): M7 ‖ M8 ‖ M9 ‖ M10 — четыре worktree с непересекающимися файлами: M7 —
  `src/ui/{базовые}`, `src/shared/**`; M8 — `src/ui/windows/**`, `src/ui/ChapterWindow*`, `src/chapters/**`,
  `src/windows/**`, `App.techstack.spec`; M9 — `src/ui/{HeroCard,BottomBar,RouteStop,Scene*}`, `src/{hero,route,mode}/**`;
  M10 — `stores/ui.ts`, `App.vue`, `scene/Scene*.vue`, `fallback2d/StaticMap.vue`, `theme/**`. Фасады (M5–M6)
  дают это: потребители уже импортируют `../<module>`, переезд меняет только `index.ts` своего модуля.
  `shared/lib/storage.ts` создаётся в M5, чтобы M7 и M10 не правили один `index.ts`.
- Волна 3: M11 → M12 → M13 → M14 → M15 → M16 → M17 → M18 — последовательно: все правят `App.vue` или
  остаток `stores/ui.ts`.
- Остановиться можно после любой задачи: фасады держат сайт и правила в рабочем состоянии.

## Что не меняется
| Что | Как проверяем |
|---|---|
| Поведение: окна, история, язык, тема, режим, сцена, бар, Hero | все vitest (≥ 686) и e2e (42) без изменения проверок |
| URL: `/`, `/ru/`, `#<chapterId>`, `?mode=`, `?theme=`, `?shot=island` | `App.*.spec`, `seo.spec`, `scripts/island.mjs` |
| Ключи хранилищ: `aboutme.theme`, `aboutme.lang`, `aboutme.motionPaused`, `aboutme.sceneChoice`, `aboutme.visited` | спеки сторов, `boot.spec` |
| Селекторы e2e: `.app`, `.app--2d/3d`, `.app__hero`, `.window`, `.scene-label`, `.static-map`, `.hotspot`, `.rack-server`, `.bottom-sheet`, роли и имена | e2e не правятся |
| Контент: `content/*.json`, схема, типы, ключи i18n | `content-schema`, `types-mirror`, `messages.spec` |
| Пути для скриптов: `src/theme/{palette,boot,contrast}.ts`, сгенерированные файлы темы, `src/content/experience.ts`, `src/fallback2d/render.ts`, `src/scene/Scene.vue` | `gen:theme` без диффа, `og`, `island`, `bundle.spec` |
| Бюджеты: main ≤ 150 КБ gzip, Scene ≤ 2 МБ, LHCI | `npm run size`, `test:lhci` на M6, M14, M17 |
| Предрендер: 8 окон в main-чанке, текст глав в HTML `/` и `/ru/` | `ssr.spec`, `bundle.spec`, бан `import()` в `chapters`/`windows` |
| Публичные контракты (API, события) | фронт их не трогает |

## Обновления документов (применяются в M18)
`frontend/CLAUDE.md`, раздел «Границы слоёв» → не длиннее текущего:
```
## Модули (граф — scripts/module-graph.mjs → eslint.config.js; тест — scripts/__tests__/layer-boundaries.spec.ts)
Модуль = src/<module>/: index.ts (2–4 строки: назначение, зависимости), *.vue, use*.ts, __tests__/.
Чужой модуль — только `../<module>` (index.ts); циклов нет; новая стрелка — строка в графе и здесь (тест сверяет).
| модуль | может импортировать |
|---|---|
| shared/lib, content | — |
| shared/ui, theme | shared/lib |
| locale | content, shared/lib |
| route, hero | content, locale, shared/* |
| chapters | content, locale, route, shared/* |
| windows | chapters, content, locale, route, shared/* |
| fallback2d | content, locale, theme, shared/* |
| scene (ленивый) | content, locale, route, theme, shared/lib |
| mode | scene, locale, shared/* |
| app | всё, кроме scene |
- three/@tresjs — только scene; scene импортирует только mode; import() сцены — только scene/index.ts.
- chapters, windows — без import(): окна в main-чанке и предрендере. max-lines 250 (кроме __tests__ и theme/gen).
```
Плюс: команда `npx vitest run src/__tests__/App.spec.ts -t "English"` → `src/locale/__tests__/App.locale.spec.ts`;
соглашение «Новые сценарии App …» → «Сценарии через App — `<module>/__tests__/App.<module>.spec.ts`,
монтировать через `app/__tests__/mountApp.ts`».

`docs/design/architecture.md` §4: блок «Слои» → «Модули (ADR-0007)» — дерево из раздела «Целевое дерево»
этого плана (одна строка на модуль), `telemetry/` этапа 4 — модуль без зависимостей от UI, живые метрики
Monitoring — ленивый модуль по образцу `scene`. Пункт «Окна читают данные только из стора контента» →
«окна (`chapters`) получают бандл пропсом, навигацию — через стор `route`».

## Риски и откат
- **Переезд ломает историю файлов** → только `git mv` и минимальные правки в том же коммите (сходство > 50 %,
  `git log --follow` работает); содержимое не переписываем при переносе.
- **`import.meta.glob` молча пустеет** (иконки, контент, glob-спеки) или vitest берёт старый кэш → M2 добавляет
  проверки «не меньше N файлов»; после каждого переноса `npx vitest --clearCache`.
- **Барели тянут лишнее в main или ломают ленивость сцены** → `index.ts` без побочных эффектов, `scene/index.ts`
  без статических `.vue`/three (правило линтера); `bundle.spec` и `npm run size` на M5, M6, M14, M17; рост main
  > 1 КБ — разбор до коммита.
- **vite-ssg: SSR-небезопасный код в новых composables** (обращение к `window` в setup) → при переносе сохраняем
  guard `typeof window`; `ssr.spec` и `npm run build` (предрендер) на каждой задаче.
- **Имя чанка `app-*.js` меняется** после переноса `App.vue` → size-limit падает «файл не найден»; проверить
  вывод `npm run size` в M17, при смене — поправить путь в `package.json` (не бюджет).
- **Scoped-стили при выносе разметки из `App.vue`** (`.app__hero`, `.app__bar` и раскладка) → стили раскладки
  остаются в `App.vue` (корневые элементы детей получают scoped-атрибут родителя); выносятся только стили
  внутренностей; `npm run shots` до/после M14–M17 и e2e.
- **Параллельные worktree конфликтуют** → волна 2 разнесена по непересекающимся файлам (см. «Параллельность»);
  `App.vue` правят только последовательные задачи.
- **T12b меняет загрузку сцены в `App.vue`** → M3, M5 и далее стартуют после его слияния; M14 переносит
  логику в редакции T12b.
- **Генератор границ ошибается и пропускает нарушение** → синтетический граф в тесте (M1) проверяет каждое
  правило отдельно; старые 7 проверок не удаляются.
- Откат: каждая задача — один коммит, `git revert` по одному; после M6 любую задачу можно откатить без
  остальных (потребители смотрят в фасады). Полный откат — revert M18…M1 по порядку; ADR-0007 → `superseded`.
