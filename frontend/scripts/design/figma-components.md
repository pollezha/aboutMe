# Figma → код: спецификация компонентов первого экрана (снимок 2026-10-22)

Источник: Figma `1D6lW84rl4yYR8VQwV10Pp`, `get_design_context` по узлам из `docs/design/figma-state.json`.
Это данные для задач T5/T6; переменные — только из `src/theme/tokens.css` (`--bg-surface`, `--space-3` …),
текст — классами из `src/theme/typography.css`. Числа без токена (36 px кружок, 56 px аватар) допустимы как литералы.

## Hero/FirstScreen (21:465; desktop 21:365 · laptop 75:462 · mobile 21:418)
Описание из Figma: первый экран (FR1). Без кликов: имя, роль, статус, формат, локация, Contact (Primary),
CV (Secondary), Telegram (Ghost), 3 цифры. **Стаж — один раз: третья метрика «IN PRODUCTION · 2+ yrs · since
July 2024» (R1), в строке роли и в баре стажа нет.** Тема/язык — только в BottomBar/TopBar. 30-sec summary —
не в Hero (R3).

| | desktop | laptop (1280×720) | mobile (< 768) |
|---|---|---|---|
| ширина | 520 | 440 | 358 (= 390 − 2×16) |
| padding / gap | `--space-6` / `--space-4` | 16 / 8 | `--space-4` / `--space-3` |
| имя | `.t-display-hero` (40) | 28 px / 1.15 / −0.5% | 32 px (override) |
| | | | |

Структура (сверху вниз): `StatusPill` «Open to work · remote / relocation» (mobile: «Open to work · remote») →
имя (h1) → роль `.t-heading-section` «.NET Backend Developer» (без стажа) → `.t-body-small --text-secondary`
«Remote or relocation in Europe · Based in Serbia · CET (UTC+1)» → CTA row (gap 8, wrap): `BaseButton primary`
«Contact», `BaseButton secondary` «CV (PDF)» + icon download, `BaseButton ghost` «Telegram» + icon external
(mobile: Telegram — `IconButton` telegram) → Metrics row (gap 8; desktop 3 × `MetricCard size=sm` flex 1 0 0;
laptop 3 × 133 px; mobile 3 в ряд по ~106 px или 155 px при переносе) → mobile: ghost «Monitoring · this site,
live →» (R-UX3). Фон `--bg-surface`, radius `--radius-lg`, shadow `--shadow-card`.

Метрики по умолчанию: «SHIPMENTS / DAY · 1000+ · through my last module»; «FILTER PAGE · 40 s → 2 s · after
moving filters to SQL»; «IN PRODUCTION · 2+ yrs · since July 2024» (значение «2+ yrs» и «since …» считаются из
`experience[]` в контенте, не строкой).

## Card/Metric (15:189) — `MetricCard.vue`
size md: min 200×114, padding `--space-4`, label `.t-label-eyebrow` (`--text-secondary`), value `.t-display-number`
(40), note `.t-body-small`. size sm: min 150×104, padding `--space-3`, value `.t-display-number-sm` (20), note 12 px
(`--font-size-xs`) `--text-secondary`, line-clamp 2. tone accent: + `border-left: 4px solid var(--chapter)` —
**жёлтый не используется**. Фон `--bg-surface-alt`, radius `--radius-md`. Значения с тонкими пробелами («40 s → 2 s»).

## Route/Stop (15:180) — `RouteStop.vue`
`<button>` (в `<nav aria-label="Chapters">`), ширина 96 (desktop) / 88 (compact), колонка, gap `--space-2`,
py `--space-2`, radius `--radius-sm`. Кружок 36×36 `--radius-full`; номер `IBM Plex Mono Bold 12` (`.t-mono-stack`
+ bold) `--text-secondary`; title `.t-label-caption`; subtitle 12 px `--text-secondary`; текст по центру.
Состояния: default — `--bg-surface` + border 2px `--border`; hover — `--bg-surface-alt` + border `--text-primary`;
focus-visible — рамка 2px `--focus-ring` вокруг всей кнопки; active (`aria-current="step"`) — кружок `--accent` +
`--shadow-pressed`, номер `--text-on-accent`; visited — `--bg-surface-alt`, вместо номера `Icon check` 18 px
`--status-success`. Клик → emit `open` сразу (D5).

## BottomBar (19:450; desktop 19:270 · compact 19:369) — `BottomBar.vue`
`<nav aria-label="Chapters">`. desktop (≥ 1366): высота `--size-bottom-bar` (120), px `--space-6`, py `--space-4`,
gap `--space-6`, ширина 1376 (= 1440 − 2×32). compact (768–1365): высота 104, px/gap `--space-5`, py `--space-3`.
Слева Profile: аватар `--accent` круг 56 (compact 44) с «YP» `.t-heading-section` `--text-on-accent` + имя
`.t-body-strong` + роль `.t-body-small --text-secondary` (**без стажа**). Центр Route: 6 × RouteStop между ними
пунктирная «дорога» (линия `border-top: 3px dashed`, цвет `color-mix(in srgb, var(--text-primary) 55%,
transparent)`, top 26 px, от центра первого до центра последнего кружка). Справа Actions (gap 8): `BaseButton
primary` «Contact», `BaseButton ghost` «Monitoring», `IconButton theme` (pressed = тёмная тема), `IconButton lang`.
Фон `--bg-surface`, radius `--radius-lg`, shadow `--shadow-panel`. Остановки: 01 Profile · About me; 02 ProSpace ·
Latest role; 03 TimePath · Previous role; 04 Tech stack · Skills; 05 Education · BSc 2025; 06 Contact · Your team.
< 768 — 2D-бар 72 px fixed внизу: 6 кружков 44 + подпись имени главы 12 px (Screens/Phone 56:1408), Contact/Monitoring
в Hero.

## Pin/Compact (75:515) — для 2D-карт (T6)
Круг 36×36 цветом `--chapter-<name>`, номер `IBM Plex Mono Bold 12` (`--text-on-dark`; для summary/светлых —
`--text-on-accent`), shadow `--shadow-card`, `<button aria-label="<NN Name>">` поверх хотспота.
