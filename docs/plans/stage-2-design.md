# План: этап 2 «Дизайн → код»

Спека: docs/spec/portfolio-mvp.md (FR1, FR4, FR5, FR7, FR10, NFR1–NFR3) · Дизайн: docs/design/architecture.md §4
Источник истины дизайна: Figma <https://www.figma.com/design/1D6lW84rl4yYR8VQwV10Pp> — ID сущностей в
`docs/design/figma-state.json`, правила и контент — `docs/design/figma-brief.md`. Страница 📝 Specs содержит
таблицу «Figma-компонент → Vue-файл → CSS-переменные → props» — задачи ниже реализуют её построчно.
ADR: 0003 (HTML поверх 3D), 0004 (контент как JSON), 0005 (Vue)

Решение пользователя 2026-10-22: работаем по текущему зафиксированному дизайну; открытые решения (Specs §7:
danger в Night, 30-sec summary вне панели, дата стажа, плейсхолдеры, метрики Monitoring) в коде остаются
плейсхолдерами/значениями из Figma и закрываются позже без переделки структуры.

Цель этапа: дизайн-система и HTML-слой первого экрана в коде, 1:1 с Figma, с автоматической проверкой
соответствия (токены, контраст, размеры) — чтобы этап 3 (сцена, окна с контентом) собирался на готовых
компонентах.

Зависимости этапа (одобрение плана = согласие): `@fontsource-variable/bricolage-grotesque` (variable, wght) и `@fontsource/ibm-plex-mono` (variable-версии нет; только
веса 400 и 700, latin+cyrillic; суммарно ≤ 150 КБ — проверяется тестом).
Больше ничего: TresJS, vite-ssg, Playwright, Lighthouse — этап 3.

Чтение Figma в задачах: через MCP `get_variable_defs` / `get_design_context` по node-id из `figma-state.json`.
Файл Figma при этом **не изменяется**; никакие другие файлы Figma не открываются.

## Задачи
Каждая задача: укладывается в половину контекста, даёт рабочее состояние, один коммит.

- [x] T1 — Токены: экспорт переменных Figma → `palette.ts` + CSS-переменные, тест соответствия и контраста
  - Файлы: `frontend/scripts/design/figma-tokens.json` (снимок Semantic × 3 режима + Layout + text/effect styles —
    **уже снят оркестратором 2026-10-22**, задача его не меняет), `frontend/src/theme/palette.ts` (типизированный
    объект `{ day, evening, night }` + `layout`, сгенерированный из снимка скриптом `frontend/scripts/gen-theme.mjs`),
    `frontend/src/theme/tokens.css` (`:root[data-theme="day|evening|night"] { --bg-surface: … }` из того же снимка),
    `frontend/src/theme/contrast.ts`, `frontend/src/theme/__tests__/palette.spec.ts`.
  - Тест сначала: (1) `palette.ts` и `tokens.css` содержат ровно те имена, что в снимке Figma (ни больше, ни
    меньше); (2) для каждой темы пары из явного списка `TEXT_ON_BG` (text/primary и text/secondary на bg/surface
    и bg/surface-alt; text/on-accent на accent/primary; text/on-dark на chapter/techstack) ≥ 4,5:1 — те цифры,
    что на странице Foundations; (3) `status/danger` в Night — ожидаемо проваливает и помечен `knownIssue`
    (Specs §7), тест фиксирует текущее значение, а не «зелёнит» его; (4) ни один размер шрифта < 12.
  - Готово, когда: тесты зелёные; `gen-theme.mjs` идемпотентен (повторный запуск не меняет файлы — проверка
    в CI через `git diff --exit-code`).
  - Зависит от: —

- [x] T2 — Шрифты и типографика: self-hosted шрифты + классы текстовых стилей
  - Файлы: `frontend/src/theme/fonts.css` (@fontsource-variable/bricolage-grotesque + @fontsource/ibm-plex-mono 400/700, только latin + cyrillic), `frontend/src/theme/
    typography.css` (классы `.t-display-hero`, `.t-heading-window`, … — по 11 стилям Figma: размер, line-height,
    letter-spacing, вес), `frontend/src/theme/__tests__/fonts.spec.ts`.
  - Тест сначала: суммарный размер подключённых woff2 ≤ 150 КБ (читается из `node_modules/@fontsource-variable/
    */files`, только latin/cyrillic-wght); в `typography.css` есть класс на каждый стиль из `figma-state.json
    → textStyles`.
  - Готово, когда: тесты зелёные; `npm run build` проходит, бюджет первого экрана (JS) не вырос.
  - Зависит от: — (параллельно с T1)

- [x] T3 — Базовые компоненты: Icon, Button (Primary/Secondary/Ghost/Icon), Tag/Chapter, Pill/Status
  - Файлы: `frontend/src/ui/Icon.vue` + `icons/*.svg` (13 иконок, экспорт из Figma `get_design_context` узлов
    Icon/*), `BaseButton.vue` (variant primary|secondary|ghost, size md|lg, disabled; стили только через
    CSS-переменные из T1), `IconButton.vue` (44×44), `ChapterTag.vue`, `StatusPill.vue`;
    тесты `frontend/src/ui/__tests__/{BaseButton,IconButton,ChapterTag,StatusPill}.spec.ts`.
  - Тест сначала: BaseButton рендерит `<button>`, прокидывает `disabled` и `aria-*`, variant/size → классы;
    IconButton требует `aria-label` (тест падает без него); ChapterTag ставит `--chapter` на нужную переменную
    главы; focus-visible стиль присутствует (проверка класса/computed через jsdom не надёжна — проверяем, что
    CSS содержит `:focus-visible` с `--focus-ring`).
  - Готово, когда: тесты зелёные; в компонентах нет «голых» hex (тест-грепом по `src/ui/**/*.vue`: 0 совпадений
    `#[0-9a-f]{3,6}`).
  - Зависит от: T1, T2

- [x] T4 — Dialog + Window/Shell
  - Файлы: `frontend/src/ui/Dialog.vue` (native `<dialog>` + `showModal()`, Esc, возврат фокуса,
    `aria-labelledby`, backdrop, без transition при reduced-motion), `ChapterWindow.vue` (eyebrow с акцентом
    главы, заголовок, подзаголовок, close, slot, футер Proof & links, prev/next; desktop ≤ `--size-window-max`,
    mobile на весь экран), тесты `Dialog.spec.ts`, `ChapterWindow.spec.ts`.
  - Тест сначала (AC4 на компоненте): open → фокус внутри; Esc → закрыто, фокус на открывателе; `aria-modal`,
    `aria-labelledby` выставлены; prev/next эмитят; reduced-motion → нет класса анимации.
  - Готово, когда: тесты зелёные.
  - Зависит от: T3

- [x] T5 — Route/Stop, BottomBar, Hero/FirstScreen, Card/Metric + расширение контента
  - Файлы: `RouteStop.vue`, `BottomBar.vue` (desktop | compact; на < 768 — fixed, 72 px, номера с aria-label),
    `HeroCard.vue` (desktop | mobile; стаж из дат), `MetricCard.vue`; `content/schema/content.schema.json` +
    `content/en.json`: `profile.location`, `profile.highlights[3]`, `experience[]` с датами;
    `frontend/src/content/experience.ts` (расчёт стажа); тесты на каждый компонент + `experience.spec.ts`.
  - Тест сначала: клик по остановке эмитит `open(stop)` сразу (D5); активная — `aria-current="step"`; все
    остановки достижимы Tab; Hero показывает имя, роль, статус, 3 метрики из контента; стаж считается из дат
    (`2024-07-01` → `2026-10-22` = «2 yrs 3 mo»), не строкой; валидатор контента зелёный.
  - Готово, когда: тесты зелёные; `npm run build` — Content OK.
  - Зависит от: T3

- [x] T6 — Первый экран в приложении + 2D-режим + сверка с Figma
  - Файлы: `frontend/src/App.vue` (HTML-слой: TopBar, Hero, BottomBar; слот сцены — пока заглушка с
    `scene/sky` фоном), `frontend/src/fallback2d/StaticMap.vue` (картинка острова + 8 хотспотов-кнопок с
    aria-label, координаты в %), `frontend/src/stores/ui.ts` (theme, lang, mode 2d/3d, activeStop,
    openWindow), `frontend/scripts/shots.mjs` (headless Chrome: 1440×900, 1280×720, 768×1024, 390×844 × day/night
    → `docs/design/shots/`), `frontend/src/__tests__/App.spec.ts` (расширение).
  - Тест сначала: `shouldUse3D()` → false при ширине < 768 или без WebGL (мок); в 2D рендерится StaticMap с 8
    кнопками; смена темы ставит `data-theme`; окно открывается по клику на остановку и на хотспот.
  - Готово, когда: тесты зелёные; 8 скриншотов сняты; сравнение с Figma-экранами глазами (оркестратор смотрит
    скриншоты рядом с экспортом из Figma `get_screenshot` 33:2, 33:246, 34:709, 56:1378) — расхождения
    ≤ косметических, список в PR.
  - Зависит от: T4, T5

- [x] T7 — Иконки/favicon/OG/SEO-мета + закрытие чек-листа design-review
  - Файлы: `frontend/public/favicon.svg` (+png 192/512, `site.webmanifest`), `frontend/public/og.png` 1200×630
    (скрипт `frontend/scripts/og.mjs`, headless Chrome), `frontend/index.html` (title/description/OG/`theme-color`),
    `docs/concept/design-review.md` (чек-лист: каждый D — закрыт / отложен с причиной), `CLAUDE.md` (команды
    `gen-theme`, `shots`).
  - Тест сначала: собранный `index.html` содержит title/description/og:image/og:title; `og.png` 1200×630 (заголовок PNG).
  - Готово, когда: тесты зелёные; в чек-листе нет незакрытых «блокер»/«важно» без причины.
  - Зависит от: T6

Параллельно: T1 ∥ T2 (разные папки); после них T3; затем T4 ∥ T5 (разные файлы: `Dialog/ChapterWindow` vs
`RouteStop/BottomBar/HeroCard/MetricCard` + content) — два implementer в worktree; T6, T7 — последовательно.

## Покрытие: требования → задачи
| Требование / пункт | Задачи | Проверка на шлюзе |
|---|---|---|
| NFR3 контраст ≥ 4,5:1, фокус, reduced-motion | T1, T3, T4 | palette.spec, Dialog.spec, grep `:focus-visible` |
| NFR1 шрифты ≤ 2 семейства, ≤ 150 КБ | T2 | fonts.spec |
| FR5 окна — модальные диалоги (AC4 на компоненте) | T4 | Dialog.spec |
| FR1 первый экран без кликов; D2 цифры; D3 EN/RU, локация | T5, T6 | Hero.spec + скриншоты 1280×720 и 390×844 |
| FR4 панель; D5 окно сразу | T5 | BottomBar.spec |
| FR7 темы из одной палитры | T1, T6 | tokens.css, скриншоты day/night |
| FR10 2D-режим: панель + хотспоты, без списка глав | T6 | App.spec, скриншоты 768/390 |
| D1 адаптив 1440 / 1280×720 / 768 / 390 | T5, T6 | 8 скриншотов vs Figma |
| D12 SEO/OG | T7 | тест index.html + og.png |
| D21 стаж из дат | T5 | experience.spec |
| Figma = источник истины | T1, T2, T3 | тест имён токенов/стилей = ledger; 0 «голых» hex |

## Шлюз этапа 2
1. Все задачи T1–T7 с зелёными тестами; `npm run lint && format:check && typecheck && test && build` зелёные.
2. Токены и стили в коде = Figma (тесты T1/T2); 0 «голых» цветов в `src/ui` (T3).
3. 8 скриншотов первого экрана визуально совпадают с Figma-экранами (список расхождений в PR).
4. Чек-лист design-review закрыт (T7).
Затем `/verify` → `/review` → `/learn` → PR в main, тег `v0.2.0`.

## Расхождения код ↔ Figma после T6 (для T7 / Specs §7)
- **Решение:** цифры пинов (белые) на chapter-цветах < 4,5:1 (Day prospace 3,3; Night 1,7–3,5) — тёмный номер
  на светлых акцентах; расширить palette.spec парами on-dark × chapter/* по темам (отмечено в T3).
- CV-кнопки нет: в `content/en.json` нет ссылки kind=cv (D6 — ждёт файл). Добавить плейсхолдерный путь нельзя
  (валидатор), значит кнопка появится вместе с CV.
- Тема: кнопка «pressed» только в night; тема циклична day→evening→night — решить индикацию (3 иконки?).
- Телефон: метрики переносятся на 3 строки (в Figma короткие подписи «my last module», «40s→2s») — короткие
  варианты note для sm в контенте или CSS-clamp; роль на 390 крупнее Figma.
- Планшет: остановки 72 px → «Previous role» переносится; порядок Contact/Monitoring в баре обратный Figma;
  бар на 16 px выше низа (Figma — вплотную). Скриншот 768 снят в 3D (headless имеет WebGL2) — добавить `?mode=2d`.
- Статус-пилюля «Open to work» без «· remote / relocation»; строка локации «Remote / relocation · …» vs Figma
  «Remote or relocation in Europe · …» — контент.
- Кнопки 14 px/44 vs Figma 16 px/48 у Contact — уточнить токен size lg.

## Что сознательно оставлено на потом (не блокирует)
- **Контраст номера в ChapterTag (Night):** светлые акценты (prospace #FF8A4C, timepath #4FD1C0) с номером
  `text/on-dark` могут быть < 4,5:1 — проверить в T6 расширением palette.spec (пары on-dark × chapter/* по темам);
  при провале — тёмный номер для светлых акцентов.
- **Кириллица:** у Bricolage Grotesque нет cyrillic-subset — RU-тексты на `--font-text` рендерятся system-ui.
  Решение пользователя: принять fallback / выбрать второй шрифт для RU (новая зависимость) / сменить семейство.
  До решения — knownIssue в Specs §7; на EN-версию не влияет.
- Открытые решения Specs §7 — значения из Figma как есть; `status/danger` Night помечен knownIssue.
- Контент окон 01–08 в коде — этап 3 (окна здесь только каркасом `ChapterWindow`).
- Сцена TresJS и грузовик — этап 3; в T6 на месте сцены заглушка цвета `scene/sky` или статичная карта.

## Риски и откат
- MCP Figma недоступен в сессии implementer (нужна авторизация) → оркестратор сам снимает `get_variable_defs`
  и `get_design_context` в `frontend/scripts/figma-tokens.json` / SVG иконок и передаёт файлы задаче; тесты
  работают от снимка, не от живого Figma.
- Шрифты latin+cyrillic не влезают в 150 КБ → только `wght`-ось, без italic; откат — системный стек.
- Native `<dialog>` в jsdom ограничен → в Vitest проверяем атрибуты/события/фокус через `HTMLDialogElement`
  полифилл-минимум; реальное поведение — скриншоты и ручная проверка в T6.
- Расхождения скриншотов с Figma > косметических → правим код, не Figma (Figma — источник истины); если
  дизайн нереализуем (например, высота панели на 1280×720) — фиксируем в Specs §7 и спрашиваем пользователя.
- Любая задача ломает фронт → `git revert` коммита.
