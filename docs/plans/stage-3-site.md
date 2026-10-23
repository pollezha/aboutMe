# План: этап 3 «Сайт без бэкенда» — первый показываемый релиз

Спека: docs/spec/portfolio-mvp.md (FR1–FR11, NFR1–NFR3, AC1–AC7, TC-01…TC-11) · Дизайн: docs/design/architecture.md §4
Roadmap: docs/plans/roadmap.md, этап 3 (E3-T1…T10) · ADR: 0003 (HTML поверх 3D), 0004 (контент как JSON),
0005 (Vue + TresJS), 0006 (Cloudflare Pages).
Источник истины дизайна: Figma `1D6lW84rl4yYR8VQwV10Pp` — окна `Window/01…08` (ID в `docs/design/figma-state.json`,
раздел `windows`), экраны состояний `Screen/State/*`, правила — `docs/design/figma-brief.md`. Решения ревью
этапа 2 (R1–R4, review-consolidated §3) — обязательны.

Цель этапа: сайт на статическом JSON, предрендеренный, с 3D-сценой и 2D-режимом, на публичном URL.
Выход — ссылка, которую уже можно отправлять рекрутерам.

Статус: **approved 2026-10-23**. Решения пользователя: зависимости одобрены; `[ADD]` (метрика ProSpace, фото, LinkedIn) — пока пропустить, из контента убрать; RU-тексты пишет агент сам, пользователь правит их в Figma, агент переносит в JSON (контур «дизайн → код»); Cloudflare — объяснить, решить к T13.

## Зависимости этапа (новые пакеты, версии на 2026-10-22)
| Пакет | Зачем | Задача |
|---|---|---|
| `three@0.186`, `@types/three`, `@tresjs/core@5.10`, `@tresjs/cientos@5.10` | сцена (ADR-0005) | T7 |
| `vue-router@5`, `vite-ssg@28`, `@unhead/vue@3` (требование vite-ssg) | предрендер `/` и `/ru/`, meta/hreflang (FR11) | T5 |
| dev: `@playwright/test@1.64`, `@axe-core/playwright@4.14` | TC-01…08, TC-11, AC4 | T11 |
| dev: `@lhci/cli@0.15`, `size-limit@14`, `@size-limit/file` | AC2, T1/T3/T4 из спеки | T12 |

Больше ничего. SignalR, телеметрия (`telemetry/`), content-api — этап 4. Blender-модели — вне MVP: здания из
примитивов three, с тем расположением, что в концепте.

## Что делает оркестратор до раздачи задач (T0, без коммита кода)
- Снимок окон из Figma: `get_design_context` по `Window/0N …/Desktop` и `/Mobile` → `frontend/scripts/design/figma-windows.md`
  (структура, text styles, токены, порядок блоков, состояния) — по образцу `figma-components.md`. Implementer
  читает только снимок; Figma не трогает.
- Снимок геометрии сцены из концепта: позиции зданий/дорог/воды и путевые точки из `docs/concept/mockup-v6.html`
  (точечный grep, не чтение целиком) → `frontend/scripts/design/scene-layout.json`.
- Повторный экспорт токенов (шлюз, пункт 0) — только если дизайн-сессия что-то меняла.

## Задачи
Каждая задача: укладывается в половину контекста, даёт рабочее состояние, один коммит. Тест сначала.

- [x] T1 — Контент глав в JSON: схема, EN-данные, типы, правила валидатора
  - Файлы: `content/schema/content.schema.json` (новые `$defs`: `chapter`, `paragraph`, `bullets`, `rack`,
    `server`, `project`, `course`; поле `chapters` с ключами `profile|prospace|timepath|techstack|education|
    contact|summary`), `content/en.json` (тексты из CV + Figma-окон; серверы Tech stack со ссылкой на
    `experience[].id` и `from/to` для расчёта срока — FR6 «опыт из дат»), `frontend/src/content/types.ts`,
    `frontend/scripts/content-rules.ts` (+ правило: у каждого `server` есть хотя бы одна `usedIn`-запись,
    `experienceId` существует), `frontend/scripts/__tests__/content-rules.spec.ts`.
  - Тест сначала: схема отвергает главу без `title`; `[ADD]` внутри `chapters.*` роняет валидатор с путём поля
    (TC-10); `server.experienceId`, которого нет в `experience[]`, — ошибка с путём.
  - Готово, когда: `npm run validate:content` зелёный на `content/en.json` без единого `[ADD]`/`#`; типы
    зеркалят схему (тест на ключи); `experience.ts` считает срок сервера как объединение интервалов его `usedIn`.
  - Зависит от: — (блокирует T2–T4, T6). Открытые `[ADD]` из спеки (метрика ProSpace, фото, LinkedIn) —
    если пользователь не дал, пункт убирается из контента, а не остаётся плейсхолдером.

- [x] T2 — Окна 01 Profile, 02 ProSpace, 03 TimePath с контентом
  - Файлы: `frontend/src/ui/windows/ProfileWindow.vue`, `ProSpaceWindow.vue`, `TimePathWindow.vue`,
    общие блоки `ui/windows/blocks/` (`KeyNumbers`, `Timeline`, `BulletList`, `ProjectCard`), `App.vue`
    (подстановка тела окна по `ChapterId` через `<component :is>`), тесты `ui/windows/__tests__/*.spec.ts`.
  - Тест сначала: окно ProSpace рендерит заголовок, период из `experience[]` (`Jan 2026 — now`), список
    проектов из JSON; Profile показывает KEY NUMBERS (те же 3 метрики, что Hero, `resolveHighlights`);
    текст окна не содержит строк вне контента (нет захардкоженных дат).
  - Готово, когда: три окна 1:1 со снимком `figma-windows.md` (desktop + mobile), prev/next строго по 6
    остановкам (R4), eyebrow «Stop N of 6 · …» (R2), все цвета через токены (тест `tokens-only` на
    `src/ui/windows`).
  - Зависит от: T1.

- [x] T3 — Окно 04 Tech stack: стойки, серверы, опыт из дат, мобильный bottom-sheet
  - Файлы: `ui/windows/TechStackWindow.vue`, `ui/windows/blocks/Rack.vue`, `Server.vue`, `ServerDetails.vue`
    (desktop — панель справа; < 768 — bottom-sheet snap 60 % с `aria-expanded`, UX14), `content/experience.ts`
    (срок сервера), тесты.
  - Тест сначала: выбор сервера Kafka показывает срок (посчитан из дат, не строка), «где применял», «что делал»
    (TC-09); клавиатура: стрелки ←/→ внутри стойки, Enter выбирает, `aria-selected`; на 390 px детали в
    bottom-sheet и фокус переходит в него.
  - Готово, когда: TC-09 проходит в Vitest; стойки перекомпонованы по Figma (review 18, без «дыр»); 0 нарушений
    axe в jsdom-прогоне (`vitest-axe` не добавляем — проверка в T11).
  - Зависит от: T1. Параллельно с T2.

- [x] T4 — Окна 05 Education, 06 Contact, 07 30-sec summary, 08 Monitoring (статичное состояние)
  - Файлы: `ui/windows/EducationWindow.vue`, `ContactWindow.vue` (одна Primary «Send message» → до этапа 4
    ведёт в Telegram, FR17; CV EN/RU Secondary; ссылка «30-sec summary», R3), `SummaryWindow.vue`
    (deep-link `#summary`), `MonitoringWindow.vue` (каркас Figma 31:1577 в состоянии `offline`: «last known»,
    серый LED, ссылка на репозиторий, ссылка на summary; живые данные — этап 5), тесты.
  - Тест сначала: `#summary` открывает окно без prev/next; Contact содержит ровно одну primary-кнопку и
    ссылки на оба CV; Monitoring в offline-состоянии не делает сетевых запросов.
  - Готово, когда: все 8 окон открываются из бара/пинов/deep-link и в 2D (AC6 без 3D), снимки 1:1 с Figma.
  - Зависит от: T1. Параллельно с T2, T3.

- [x] T5 — Предрендер vite-ssg: маршруты `/` и `/ru/`, head, inline-скрипт темы и языка
  - Файлы: `frontend/src/main.ts` (`ViteSSG` + router с 2 маршрутами), `src/router.ts`, `src/head.ts`
    (title/description/OG/`hreflang` + `x-default` из контента), `index.html` (inline-скрипт в `<head>`:
    `data-theme`/`theme-color`/`color-scheme` из localStorage до CSS — minor из ревью этапа 2; переход на
    `/ru/` при RU-языке браузера и отсутствии сохранённого выбора), `vite.config.ts` (`ssgOptions`),
    `src/stores/ui.ts` (lang ↔ маршрут, `<html lang>`), тесты (`ssr`-рендер `renderToString` содержит текст
    всех глав; `head.spec.ts`).
  - Тест сначала: `npm run build` создаёт `dist/index.html` и `dist/ru/index.html`, в каждом — заголовки всех
    8 окон на своём языке и `<link rel="alternate" hreflang>`; `curl`-проверка (TC-11) оформлена как
    Vitest-тест по файлам `dist/`.
  - Готово, когда: сборка без `window`-ошибок SSR (все обращения к `window`/`localStorage` под guard);
    `vite preview` отдаёт обе страницы; вспышки темы нет (ручная проверка + скриншот ночной темы без JS).
  - Зависит от: T2–T4 (контент окон в HTML). Можно начать каркас параллельно, финал — после T4.

- [x] T6 — RU-контент и переключение языка без перезагрузки (AC5, TC-06)
  - Файлы: `content/ru.json` (тексты — **пользователь**, агент раскладывает по схеме; лимит подписей ≤ 14
    символов, перенос вместо усечения — UX16), `frontend/src/i18n/ru.json` (все строки интерфейса),
    `src/content/index.ts` (бандл по языку), `src/i18n/index.ts` (убрать TODO: `<html lang>`), тесты.
  - Тест сначала: при `lang=ru` Hero/бар/окна рендерят RU-контент; переключатель меняет язык и URL (`/ru/`)
    без перезагрузки; `<html lang="ru">`.
  - Готово, когда: `validate:content` зелёный на обоих файлах; TC-06 в Vitest; скриншоты `*-ru.png` обновлены.
  - Зависит от: T1, T5. **Если RU-тексты не готовы** к моменту задачи: интерфейс RU делаем (i18n), контент
    остаётся EN, `/ru/` не публикуется (hreflang только EN) — переносится в этап 7 (roadmap).

- [x] T7 — Spike сцены: TresJS, ленивый чанк, бюджет, загрузка с «Continue without 3D»
  - Файлы: `frontend/src/scene/index.ts` (динамический импорт после `requestIdleCallback`), `scene/Scene.vue`
    (ортокамера, свет, остров-плита и вода из примитивов по `scene-layout.json`, цвета из `palette[theme].scene`),
    `ui/SceneLoading.vue` (Figma `Screen/State/Loading scene` 34:964: карточка не над Hero, кнопка «Continue
    without 3D», таймаут 8 с → 2D + баннер, UX9), `stores/ui.ts` (`userChoice`, `sceneState`), `App.vue`,
    `package.json` (size-limit: main ≤ 150 КБ gzip, чанк сцены ≤ 2 МБ), тесты (`shouldUse3D` с `userChoice`,
    таймаут через fake timers, `performance.mark('scene_ready')`).
  - Тест сначала: без вызова `import('./scene')` main-чанк не содержит three (тест по `dist/` manifest);
    через 8 с без `scene_ready` режим = 2D и показан баннер; клик «Continue without 3D» запоминается.
  - Готово, когда: `npm run build` печатает размеры в бюджете; сцена видна в браузере в 3 темах; лимит
    времени spike — 1 рабочий день; при провале бюджета/производительности — чистый three (ADR-0005, вариант B).
  - Зависит от: — (блокирует T8–T10). Параллельно с T1–T4.

- [x] T8 — Здания, подписи, клик и поворот карты (FR2)
  - Файлы: `scene/Island.vue`, `scene/Roads.vue`, `scene/Water.vue`, `scene/buildings/Building.vue` (+ 6 главных
    и фоновые через `InstancedMesh`), `scene/Labels.vue` (cientos `Html`: `<button>` с именем главы,
    `tabindex=-1` — Tab идёт по бару, Specs §3), `scene/useCamera.ts` (поворот 90°, 300 мс, мгновенно при
    reduced-motion; кнопка rotate + клавиша R, tooltip «Rotate map · R»), тесты логики (`useCamera`, маппинг
    клик → `ui.openChapter`).
  - Тест сначала: клик по зданию ProSpace вызывает `openChapter('prospace')`; после поворота на 90° подписи
    остаются над своими зданиями (проекция); тема `night` меняет цвета материалов из `palette`.
  - Готово, когда: 6 зданий кликабельны мышью, TC-02 (в Playwright — T11); FPS ≥ 50 на ноутбуке без дискретной
    графики (замер в DevTools, приложить).
  - Зависит от: T7.

- [x] T9 — Грузовик и маршрут (FR3, AC3)
  - Файлы: `scene/Truck.vue`, `scene/useRoute.ts` (путевые точки из `scene-layout.json`, `useLoop`, курс
    `atan2`, перенаправление при клике во время езды, телепорт при reduced-motion/паузе `motionPaused`),
    `stores/ui.ts` (`activeStop` ← прибытие), тесты (`useRoute`: чистая функция положения от времени).
  - Тест сначала: `advance(t)` даёт позицию на отрезке; новая цель посреди пути строит маршрут от текущей
    точки; reduced-motion → позиция = цель сразу.
  - Готово, когда: окно открывается сразу (≤ 600 мс — замер T11), грузовик приезжает фоном; визит остановки
    отмечает `visited` (sessionStorage, решение 19).
  - Зависит от: T8.

- [x] T10 — 2D-режим: рендеры острова по темам, явный выбор, `?mode=2d`
  - Файлы: `frontend/scripts/island.mjs` (headless Chrome → `public/img/island-{day,evening,night}.webp`
    и `@2x`; общий `scripts/cdp.mjs`, выделенный из `shots/og/cv`), `fallback2d/StaticMap.vue` (`src` по теме,
    `srcset`, `fetchpriority=high` — LCP), `App.vue` (`?mode=2d`, кнопка «Switch to 2D/3D» в верхних
    контролах), `figma-2d-map.json` (хотспоты сверены с рендером), тесты.
  - Тест сначала: `?mode=2d` → `ui.mode === '2d'` при наличии WebGL; смена темы меняет `src` картинки;
    хотспоты 6 + Monitoring имеют `aria-label` с именем главы.
  - Готово, когда: AC6 (WebGL off и 390 px) — все 8 окон открываются; скриншоты 768/390 сняты в 2D
    (`?mode=2d`, урок этапа 2); webp ≤ 120 КБ каждый.
  - Зависит от: T8 (рендер со сцены). Хотспоты и `?mode=2d` можно сделать до T8 на текущей заглушке.

- [ ] T11 — Playwright: smoke, клавиатура, axe по 8 окнам × 3 темы
  - Файлы: `frontend/playwright.config.ts` (chromium; проекты `desktop-1280`, `phone-390`, `no-webgl`
    через `--disable-webgl`), `frontend/e2e/first-screen.spec.ts` (TC-01: видимость без прокрутки, обе темы,
    скриншоты), `e2e/windows.spec.ts` (TC-02, TC-03 замер ≤ 600 мс, TC-07, TC-08 `mode`/темы),
    `e2e/keyboard.spec.ts` (TC-04: Tab по 6 остановкам/CTA/тема/язык, Enter/Esc, возврат фокуса),
    `e2e/a11y.spec.ts` (TC-05: axe на странице и в каждом окне в 3 темах, 0 serious/critical),
    `e2e/seo.spec.ts` (TC-11 по `dist/`), `package.json` (`test:e2e` на `vite preview` после build).
  - Тест сначала: сами e2e — тесты; первый прогон должен поймать хотя бы одну реальную проблему (ожидаемо —
    фокус/контраст в окнах), иначе проверить, что axe действительно сканирует открытые диалоги.
  - Готово, когда: все e2e зелёные локально; отчёт + скриншоты 1280/390 × день/ночь в `docs/design/e2e/`;
    шаг CI подготовлен как патч `ci.yml` для пользователя (хук запрещает правку workflow агентом).
  - Зависит от: T5, T10 (и T8/T9 для сценовых проверок; до них — `?mode=2d`).

- [ ] T12 — Lighthouse CI и size-limit с бюджетами (AC2, T1–T4 спеки)
  - Файлы: `frontend/lighthouserc.cjs` (mobile, `/` и `/ru/`, assertions: perf ≥ 85, a11y ≥ 95, bp ≥ 95,
    seo ≥ 95, LCP < 2500 мс, `scene_ready` user timing < 4000 мс), `package.json` (`size-limit`: main gzip
    ≤ 150 КБ, чанк сцены ≤ 2 МБ, шрифты ≤ 150 КБ — заменяет `fonts.spec` или дублирует его), `test:lhci`,
    патч `ci.yml` для пользователя.
  - Тест сначала: занижённый бюджет роняет `lhci autorun`/`size-limit` (проверка, что ассерты реально работают).
  - Готово, когда: локальный `lhci autorun` зелёный на `dist/`; цифры приложены в отчёт `/verify`.
  - Зависит от: T5, T7.

- [ ] T12b — Производительность до порогов AC2 (добавлено 2026-10-23 по базовой линии T12)
  - Файлы: `frontend/index.html`/`vite.config.ts` (modulepreload чанка сцены на desktop; старт загрузки сцены
    сразу после монтирования, а не после idle), `src/scene/index.ts`, `src/main.ts` (main JS 94 КБ gzip → цель
    ≤ 80: проверить tree-shaking vue-i18n/unhead/router, unused JS 37 КБ), критический CSS (beasties идёт с vite-ssg),
    HTML предрендера 70 КБ (дубли инлайн-SVG). `lighthouserc.cjs` не менять.
  - Тест сначала: `npm run perf:scene` < 4000 мс (медиана); `npm run test:lhci` зелёный при `VITE_SITE_ORIGIN`.
  - Готово, когда: perf ≥ .85 на `/` и `/ru/`, LCP < 2.5 с, scene_ready < 4 с (эталон — CI; локально — с поправкой
    на антивирус, см. learnings).
  - Зависит от: T11, T12.

- [ ] T13 — Деплой на Cloudflare Pages, публичный URL, абсолютный `og:image`
  - Файлы: `frontend/wrangler.jsonc` или настройки проекта Pages (сборка `npm run build`, выход `dist`,
    `NODE_VERSION=24`), `frontend/public/_headers` (кэш `immutable` для `assets/`, `X-Content-Type-Options`,
    `Referrer-Policy`), `_redirects` (нет — SPA-фоллбек не нужен при предрендере), `src/head.ts`
    (`og:image`/`canonical` от `SITE_ORIGIN` из env), README «как задеплоить».
  - Действия пользователя: создать проект Pages, подключить репозиторий (или дать `CLOUDFLARE_API_TOKEN`
    + `CLOUDFLARE_ACCOUNT_ID` в GitHub Secrets и принять патч workflow с `wrangler pages deploy`).
  - Готово, когда: сайт открыт по `*.pages.dev`, скриншот; Lighthouse на проде ≥ бюджетов; OG-превью
    в Telegram показывает картинку.
  - Зависит от: T5, T11, T12. Домен — открытый вопрос спеки, не блокирует (временный `pages.dev`).

- [ ] T14 — Хвосты ревью этапа 2 и тест на людях
  - Файлы: `frontend/scripts/tokens-only.spec.ts` (глобы расширены на `src/scene`, `src/ui/windows`),
    `scripts/cdp.mjs` (если не выделен в T10), `docs/plans/stage-3-site.md` (отчёт), `docs/concept/design-review.md`
    (закрыть D4, D14, D17, D22, D23), `docs/design/figma-state.json` (ledger).
  - Готово, когда: 3 человека открыли сайт и за 30 с назвали имя, роль, как связаться — заметки в плане
    (шлюз); остальные пункты чек-листа закрыты.
  - Зависит от: T13.

## Параллельность
- Волна 1: T1 ‖ T7 (независимы). Затем T2 ‖ T3 ‖ T4 (все от T1) ‖ T8 (от T7). Каждая в своём worktree.
- Волна 2: T5 (после T2–T4), T9 (после T8), T10-хотспоты.
- Волна 3: T6, T10-рендеры, T11, T12 → T13 → T14.
- Контент RU (T6) — как только пользователь даст тексты; не блокирует остальное.

## AC → задачи
| AC / TC | Задачи |
|---|---|
| AC1, TC-01 | T5, T11 (скриншоты 1280/390 × день/ночь) |
| AC2, T1–T4 спеки | T7 (бюджеты), T12 (LHCI, size-limit), T13 (прод) |
| AC3, TC-03 | T9, T11 (замер ≤ 600 мс) |
| AC4, TC-04, TC-05, NFR3 | T2–T4 (окна), T8 (`tabindex=-1` у пинов), T11 (keyboard + axe) |
| AC5, TC-06, FR8 | T5 (маршрут `/ru/`, inline-redirect), T6 |
| AC6, TC-07, FR10 | T7 (явный выбор, таймаут), T10, T11 (`no-webgl`) |
| AC7, TC-10, FR9 | T1 |
| TC-02, FR2 | T8, T11 |
| TC-08, FR7 | T7/T8 (сцена из palette), T11, тест `tokens-only` (T14) |
| TC-09, FR6 | T3 |
| TC-11, FR11 | T5, T11 (`seo.spec`), T13 (абсолютный OG) |
| AC2 «3D < 4 с», T2 спеки | T7 (`scene_ready`), T12 (ассерт user timing) |

## Шлюз этапа 3 (из roadmap)
| Проверка | Как |
|---|---|
| AC1, AC3, AC4, AC6 | Playwright-отчёт T11, скриншоты 1280/390 × день/ночь |
| AC2: Perf ≥ 85, A11y ≥ 95, LCP < 2,5 с, JS ≤ 150 КБ gzip, сцена ≤ 2 МБ | `lhci autorun`, `size-limit` (T12) |
| 3D интерактивна < 4 с | `scene_ready` в LHCI user timings (T12) |
| Сайт открыт по публичному URL | ссылка + скриншот (T13) |
| 3 человека: имя, роль, контакт за 30 с | заметки в T14 |
| Токены не отстают от Figma | `npm run gen:theme` без диффа (шаг CI) |

## Риски и откат
- **Бюджет сцены.** three + TresJS + cientos могут не влезть в 2 МБ / 4 с на mid-tier → T7 ограничен одним
  днём; откат — чистый three без TresJS (ADR-0005 B) или упрощение геометрии (меньше фоновых зданий).
  2D-режим остаётся полноценным сайтом в любом случае (ADR-0003).
- **vite-ssg и SSR-небезопасный код.** Обращения к `window`/`localStorage`/`matchMedia` в setup уронят
  предрендер → все под `typeof window` guard; тест `renderToString` ловит регрессии. Откат — отключить
  `ssgOptions` и остаться SPA с `og`/`title` в `index.html` (FR11 тогда не закрыт — фиксируется как отклонение).
- **RU-контент не готов.** T6 вырождается в «RU-интерфейс», `/ru/` не публикуется; hreflang только EN.
- **Chrome headless и WebGL для рендера острова (T10).** Если SwiftShader даёт артефакты — рендер снимаем
  вручную из браузера один раз и кладём в `public/img` (файлы — артефакт, не код).
- **CI-шаги Playwright/LHCI.** Правку `.github/workflows/` делает пользователь по патчу; до этого проверки
  гоняются локально и в `/verify`.
- **Cloudflare.** Доступ/оплата — пользователь (открытые вопросы спеки); временный `pages.dev` достаточен
  для шлюза. Откат — GitHub Pages (`actions/deploy-pages`), тот же `dist/`.
- **Расхождения с Figma** в окнах > косметических → правим код; если нужно менять дизайн — сначала Figma
  (дизайн-сессия), затем задача. Ledger `figma-state.json` обновляется оркестратором.
