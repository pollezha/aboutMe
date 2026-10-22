# Сводный план правок по двум ревью Figma (designer D#1–21 + UX#1–24)

Дата: 2026-10-22 · Входы: `review-designer.md`, `review-ux.md`, план `docs/plans/stage-2-design.md`, бриф, спека MVP.
Обозначения «куда»: **Figma** — макет/токены/компоненты; **Specs** — только текст страницы 📝 Specs; **код** — Figma уже ок,
делается в задаче плана; **решение** — нужен выбор пользователя (варианты в §2). Задача «T1b» = новая мини-задача
«ресинк `figma-tokens.json` → palette/tokens.css/typography.css после правок токенов» (план T1 снимок не трогает).
«Этап 3/4» = контент окон / форма и Monitoring, вне плана этапа 2.

## 1. Единый список (дедуплицировано: 45 находок → 40 строк)

| # | Прио | Суть | Где (node-id) | Куда | Задача | Источник |
|---|---|---|---|---|---|---|
| 1 | must | Телефон: бар — кружки без подписей; на статичной карте хотспоты невидимы, запечённые пины 5 px. Нужны подписи 11–12 px под номерами + HTML-пины `Tag/Chapter` compact (круг 36, хит-зона 44) в тех же %-координатах, alt карты | 56:1378, 34:826, 34:709, 56:1408 | Figma | T5, T6 | D1 / UX2 |
| 2 | must | Жёлтый не только у CTA: метрики `Tone=accent`, выбранный сервер, чипы пути, `chapter/summary`. Перевести на surface-alt + полоса главы; `chapter/summary` → `ink/700` или `teal/600` | 26:2, 29:395, 29:725, 31:1577, 15:189 | Figma | T1b, T5 (MetricCard), этап 3 | D2 |
| 3 | must | Окна выше вьюпорта 1280×720, нет состояния «scrolled». В `Window/Shell`: max-height `min(640, 100vh−48)`, sticky Header/Footer, скролл Content, пример «scrolled» | 26:2, 29:395, 29:725, 30:1200, 31:1323, 23:498 | Figma | T4 | D3 |
| 4 | must | `focus/ring` Day/Evening жёлтый 1,4:1 → `ink/900` 2 px + offset 2; на жёлтой Primary — двойное кольцо; Night остаётся `yellow/400` | 8:9, 14:63, 14:84, 18:210 | Figma | T1b, T3 (проверка) | D4 |
| 5 | must | `chapter/techstack` Night #0B0F19 на surface 1,2:1 → `ink/300` с номером `ink/900`; проверить все 8 `chapter/*` в Night ≥ 3:1 | 8:279, 33:461 | Figma | T1b (+ правка пары on-dark в palette.spec) | D5 |
| 6 | must | Нет кнопки паузы анимаций (NFR3 требует). `Button/Icon` pause/play рядом с rotate, состояние в localStorage, = reduced-motion; строка в Specs §2 | 33:2, 34:1145, 14:106 | Figma + Specs | T6 (ui store, TopBar) | UX1 |
| 7 | must | Телефон/планшет: Monitoring (и 30-sec) недостижимы — только невидимый хотспот. Monitoring: ghost-ссылка в Hero mobile / `Monitoring` в баре 768; 30-sec — по решению R3 | 56:1378, 34:709, 21:465 | Figma (Monitoring) + решение R3 (30-sec) | T5, T6 | UX3 |
| 8 | must | Десктоп: 30-sec summary недостижим из Hero/бара, только prev/next из Contact; Specs §6/§7.2 утверждают обратное | 33:2, 33:246, 21:465 | решение R3 | — | UX4 |
| 9 | must | Specs противоречат себе и architecture: пороги 1024 vs 768; `?lang=` vs `/`+`/ru/`; `/#/<chapter>` vs `#prospace` | 36:80, 36:172, 36:3 | Specs | — (правка текста) | UX5 |
| 10 | must | Кольцо prev/next: Specs — 6, футеры окон — 8 (Contact→Summary→Monitoring→Profile) | 30:1200, 31:1323, 31:1577, 28:276, 36:3 | решение R4 | T4 (после) | UX6 |
| 11 | should | 1280×720: Hero 520×395 закрывает пол-острова; нужен `Hero Variant=laptop` 440×330, clip у фрейма, остров +40 px | 33:246 | Figma | T5, T6 | D6 |
| 12 | should | Дубли на первом экране: имя/роль/статус ×2, стаж ×3, тема/язык ×2, Contact ×3. Пока Hero виден — карточка бара = аватар + имя; тема/язык — только в баре (по FR4), сверху — rotate + pause; бутылка без третьей кнопки | 33:2, 33:5, 33:246 | Figma (см. C1) | T5, T6 | D7 / UX7 |
| 13 | should | Третья метрика Hero = стаж, дублирует строку роли и бар; формат стажа разный («2 y 3 m», «1 YR 6 MO») | 21:465, 33:2 | решение R1 (что в 3-й карточке); формат «N yrs M mo» везде — Figma | T5 (`profile.highlights`, experience.ts) | D8 / UX8 |
| 14 | should | Hero mobile: 3 метрики в 106 px ломаются и сокращаются. 2 карточки `Size=sm` в ряд, стаж — в строку роли; без сокращений | 56:1378, 21:418 | Figma (после R1) | T5 | D9 |
| 15 | should | Фразы в `Mono/Stack` (курсы, языки, «Good fit if…»). Новый `Tag/Text` (Label 14 SemiBold); моно — только технологии; языки одной строкой | 30:899, 30:1200, 28:276 | Figma | этап 3 | D10 |
| 16 | should | Contact: две жёлтые кнопки + Telegram/GitHub дважды; Summary — та же путаница. Primary только «Send message», CV — Secondary; в футере лишь то, чего нет в теле | 30:1200, 31:1323 | Figma | этап 3/4 | D11 |
| 17 | should | Мобильный футер окна 4 строки (~180 px, 21 % экрана) → 2 ряда ≤ 112 px: ссылки wrap + Prev-icon 44 и Next на ширину | 26:198, 28:372, 23:450 | Figma | T4 | D12 |
| 18 | should | Стойки 4/4/3/4/1/2 дают дыры; перекомпоновать колонки, `grid-auto-flow: dense`, панель `min-height: 0` | 29:725 | Figma | этап 3 | D13 |
| 19 | should | Абзацы 110–140 символов в строке → `max-width: 64ch` у текстовых блоков; Profile — колонка 620 + фото 240×320 | 28:276, 31:1577, 30:1200 | Figma | T4 (стиль Content) | D14 |
| 20 | should | `status/danger` Night #C62828 2,8:1 → `red/300` #F07070; закрывает knownIssue Specs §7 | 8:279, 18:210 | Figma | T1b (снять knownIssue в palette.spec) | D15 |
| 21 | should | Eyebrow без единого формата («EXIT 03» читается как «выход», нет позиции в маршруте) | 28:276, 26:2, 29:395, 31:1577 и др. | решение R2 | T4 (prop eyebrow) | D16 / UX12 |
| 22 | should | Референс-PNG несёт закрытые решения (Lab, старые пины, Email ↗, панель под баром) — замаскировать `Mask/*` и подписать; clip в 33:246 | 33:2, 33:246, 33:461, 33:478, 34:709 | Figma | T6 (сверка скриншотов) | D19 / UX21 |
| 23 | should | Загрузка: карточка перекрывает Hero, нет «Continue without 3D» (FR10 «явный выбор»), нет таймаута → 2D | 34:964 | Figma + Specs | T6 (кнопка/флаг), этап 3 (таймаут) | UX9 |
| 24 | should | Баннер «Live data is offline» поверх Hero, без ×; → полоса над сценой/тост, `role=status`, авто-скрытие | 34:1125 | Figma + Specs | этап 4 | UX10 |
| 25 | should | Одна глава — 4 имени (пин «Your team», бар «Contact», eyebrow «DESTINATION»). Имя главы одно во всей навигации, метафора — только в заголовке окна | 33:2, 15:204, 19:450, 30:1200 | Figma | T5 (подписи из `content`) | UX11 |
| 26 | should | Форма: submit не говорит, что произойдёт; required/optional не помечены; ошибка Message скопирована; нет состояний Sending/ошибка сети/429/счётчик | 30:1200, 30:1405, 18:263 | Figma + Specs | этап 4 (FR17) | UX13 |
| 27 | should | Tech stack mobile: панель сервера на 1300 px выше тапа → bottom-sheet (snap 60 %) или аккордеон под сервером, `aria-expanded` | 29:916 | Figma + Specs | этап 3 | UX14 |
| 28 | should | Monitoring без состояний: skeleton, «● live · updated N s ago», offline (серый LED, last known), «0 событий», «incl. you» | 31:1577, 31:1731 | Figma | этап 4/5 | UX15 |
| 29 | should | Нет ни одного RU-экрана (AC5); RU на 20–30 % длиннее. Один 1280×720 RU + BottomBar RU + Hero mobile RU; правило ≤ 14 символов, перенос, не усечение | Screens, 19:450 | Figma + Specs | T6 (RU-скриншот) | UX16 |
| 30 | should | Порядок Tab: пины и бар — дубли (≈20 Tab до Monitoring); §3 упоминает удалённый «список глав». Бар — каноническая `<nav>`, пины `tabindex=-1`; 2D: TopBar → Hero → хотспоты → бар | 36:54 | Specs | T6 | UX17 |
| 31 | should | «EN · RU» 20×17 px < 24 px (WCAG 2.5.8); на 768 тач 17 px → кнопки 44×28, на 768/390 `Button/Icon` lang | 33:2, 28:276 | Figma | T5, T6 | UX18 |
| 32 | should | Не описано поведение prev/next: скролл в 0, фокус на Title, `aria-live` «Chapter 3 of 6», title/hash, `replaceState` | 36:3, 23:498 | Specs | T4 | UX19 |
| 33 | should | Телефон: `safe-area-inset-bottom`, `100dvh`, scroll-lock body под окном, возврат scrollY | 56:1378, 34:709, 36:172 | Specs | T4, T5 | UX20 |
| 34 | nice | Evening отличается от Day только кремом: `text/secondary` тёплый, тень, `accent/primary-shadow`, обводка пина | 33:478, 8:144 | Figma | T1b | D17 |
| 35 | nice | `Display/Number` ls −2 % на моно ломает ритм → ls 0; «40s→2s» тонкими пробелами | 9:2, 29:395, 31:1323 | Figma | T1b (typography) | D18 |
| 36 | nice | Profile/Monitoring — пустая нижняя треть окна → `Window/Shell` `min-height: 480`, hug; Profile + фото и «Looking for» | 28:276, 31:1577 | Figma | T4 | D20 |
| 37 | nice | Три метрики Hero разной высоты; хвост «Q» в Bricolage под «SQL» → `Card/Metric` `min-height: 110`, `line-clamp: 2`; SQL моно | 21:465, 33:2 | Figma | T5 | D21 |
| 38 | nice | Ссылка на CV подписана 3 способами → «Download CV (PDF, EN)» / «Скачать CV (PDF, RU)», иконка download | 33:2, 28:276, 30:1200, 31:1323 | Figma | T5, этап 3 | UX22 |
| 39 | nice | Rotate без подписи, клавиша R не показана → tooltip «Rotate map · R», пузырь при первом визите | 33:2 | Figma + Specs | этап 3 | UX23 |
| 40 | nice | Нет макета OG 1200×630 (FR11): имя, роль, статус, 3 цифры, остров; EN и RU | Screens (нет фрейма) | Figma | T7 (og.mjs) | UX24 |

## 2. Противоречия и решения пользователя

**Конфликты между ревью / с зафиксированными решениями**
- **C1 (D7 vs UX7)** — где жить теме/языку: D7 — только верхний правый угол, UX7 — только бар. Разрешает FR4 («панель: переключатели
  темы и языка») → бар; сверху — rotate + pause (UX1). На 390 (2D, бар 72 px с номерами) — в TopBar, как уже в мобильных макетах. Решения не требует.
- **C2 (UX2 vs UX11)** — UX2 предлагает подписи бара 390 «Profile · Role · Role · Stack…» (два «Role»), UX11 — одно имя главы во всей навигации.
  Берём UX11: `Profile · ProSpace · TimePath · Stack · Education · Contact` (≤ 9 символов, 11 px — влезает в 60 px). Решения не требует.
- **C3 (D1 vs UX2)** — размер 2D-пина 28 vs 36 px: берём 36 (хит-зона 44, WCAG 2.5.8). Решения не требует.
- **C4 (UX17 vs Specs §3)** — Specs всё ещё описывают «список глав» в 2D, запрещённый решением 2026-10-21 → устаревший текст, править (строка 30).
- **C5 (D5 vs план T1)** — смена `chapter/techstack` Night на светлый ломает пару `text/on-dark × chapter/techstack` в palette.spec; в T1b пару заменить
  на `ink/900 × chapter/techstack` (Night). Совпадает с отложенным пунктом плана «контраст номера в ChapterTag (Night)».
- **C6 («Пробелы» п.16 vs CLAUDE.md)** — поле `placement` в `cta_click` меняет схему события → только через ADR; до него — без поля.

**Требуют выбора пользователя**
- **R1 — третья метрика Hero (D8/UX8).** A: другая проверяемая цифра («7M+ grid objects» или «2 companies · 2 products in prod»), стаж только в
  строке роли — UX8. B: оставить стаж как «2+ yrs» с подписью «since July 2024», убрав его из роли и бара — D8. **Рекомендую A** (три разные цифры,
  снимает тройной дубль стажа; оговорка — цифра должна подтверждаться в окне главы; если ProSpace-метрика `[ADD]` не появится — B).
- **R2 — формат eyebrow (D16/UX12).** A: `EXIT 0N · <signature>` + «дорожный знак» 20×20 — D16. B: `Stop 3 of 6 · Previous role · Jul 2024 – Dec 2025`,
  для 07/08 «Summary · 30 seconds» / «Live · this site» — UX12. **Рекомендую B со знаком из A** (`[03] Stop 3 of 6 · Waybill · даты`): ориентировка
  первыми словами, метафора остаётся, не-геймер не читает «EXIT» как «закрыть».
- **R3 — вход в 30-sec summary (UX3/UX4; пользователь ранее убрал CTA из панели, FR4/FR5/AC6 всё ещё требуют 8 окон).** A: ghost «30-sec summary» в Hero
  (desktop справа от Telegram, mobile — строкой с Monitoring) + отразить в Specs §5/§6 — UX4(а). B: окно 07 остаётся, но без входа с первого экрана:
  deep-link `#summary` (для ссылок из откликов, `?src=cv`) + ссылка «Short version →» в теле Contact и в футере Monitoring; FR4 уточнить («CTA: Contact,
  Monitoring»). **Рекомендую B**: согласуется с решением «не в панели» и с D7/UX7 (меньше дублей на первом экране), AC6 выполняется через ссылку в Contact.
  Вариант UX4(б) «удалить окно 07» не предлагаю — меняет FR5/AC6/TC-07.
- **R4 — кольцо prev/next (UX6).** A: строго 6 глав (как Specs §1 и FR5), у 07/08 — только Close и Proof & links. B: 6 + Monitoring финалом
  (Contact → Next: Monitoring → Next: Profile), 30-sec вне кольца — UX6. **Рекомендую A**: совпадает с TC-02 и Specs, не требует правки спеки;
  B — если хочется peak-end для техлида, но тогда правка FR5 и TC-02.

## 3. Правки страницы 📝 Specs (из «Пробелов» UX-ревью)
Пометка: **есть** — источник истины уже в architecture.md / плане / спеке, переписать; **принять** — предложение рецензента, можно зафиксировать без
обсуждения; **решение** — зависит от R1–R4 или нового выбора.
1. Пороги: `≥ 1366` desktop-бар · `768–1365` compact · `< 768` или нет WebGL/`deviceMemory < 4` — 2D — **есть** (architecture §4 п.4, FR10).
2. Язык: `/` и `/ru/`, редирект до гидрации по языку браузера, выбор в localStorage, hreflang + x-default — **есть** (architecture §4 п.1).
3. Deep-link `#prospace`, Back работает — **есть**; push при открытии / replace при prev/next, обновление `document.title` — **принять** (UX19).
4. Prev/Next: состав кольца — **решение R4**; фокус на Title, скролл 0, `aria-live`, ←/→ не в полях ввода — **принять** (UX19).
5. Пауза: кнопка в верхних контролах, localStorage, = reduced-motion — требование **есть** (NFR3), размещение — **принять** (UX1).
6. Загрузка сцены: «Continue without 3D» — **есть** (FR10 «явный выбор»); таймаут 8 с → 2D + баннер, текст индикатора — **принять** (UX9).
7. Offline-баннер: основа **есть** (NFR4/AC10: снимок контента); место/dismiss/авто-скрытие — **принять** (UX10).
8. 2D-пины: размеры/подписи/alt — **Figma** (строка 1), текст в §5 — после правки макета.
9. Mobile-вход в Monitoring — **принять** (строка 7); в 30-sec — **решение R3**.
10. Tech stack < 768: bottom-sheet, клавиатура в стойке, `aria-expanded` — **принять** (UX14; реализация этап 3).
11. Monitoring: окна агрегации — частично **есть** (architecture §5: онлайн = 5 мин, события за сегодня; остальное — Specs §7 open); skeleton/live/offline — **принять** (UX15).
12. Форма: honeypot (204), rate limit (429), лимиты, не логировать — **есть** (FR17, architecture §5, TC-21); тексты ошибок, Sending, поведение после успеха — **принять** (UX13).
13. RU: лимит подписей ≤ 14 символов, перенос вместо усечения — **принять** (UX16).
14. Порядок Tab: бар каноничен, пины `tabindex=-1`; 2D-порядок без списка глав — **есть** (AC4 + решение 2026-10-21), формулировка — принять UX17.
15. Safe-area / `100dvh` / scroll-lock — **принять** (UX20).
16. Телеметрия `placement`/`source` — **решение** (расширение контракта события → ADR, см. C6); до ADR — не описывать.
17. Tooltip rotate · R, подсказки ←/→, Esc — **принять** (UX23, nice).
18. OG/title/description EN+RU — **есть** (FR11, T7); макет — Figma (строка 40).
19. Visited-состояние остановки — **решение**: предлагаю «окно открывалось» в рамках сессии (sessionStorage), между визитами не хранить.
20. Backdrop: клик по подложке закрывает; клик «сквозь» по пину невозможен — native `<dialog>.showModal()` делает остальное inert — **есть** (architecture «Окна»).

## 4. Итог
- По приоритету: **must 10 · should 23 · nice 7** (40 строк из 45 находок; 5 слияний: D1/UX2, D7/UX7, D8/UX8, D16/UX12, D19/UX21).
- По адресату: **Figma (макет/токены) 30 · только Specs 5 (9, 30, 32, 33 + часть 23/24) · решение 5 (8, 10, 13, 21 + 30-sec в 7)** · чисто «код» — 0:
  Figma — источник истины, поэтому каждая правка сначала ложится в файл, затем реализуется задачей (T4 ×8, T5 ×10, T6 ×9, T1b ×6, этап 3/4 ×10).
- Открытые решения: R1 метрика, R2 eyebrow, R3 вход в 30-sec, R4 кольцо, плюс мелкие из Specs: visited (п.19) и `placement` в событиях (п.16, через ADR).

**Пакет для дизайн-агента** (must + should, куда = Figma/Specs, без зависимостей от R1–R4; один заход, порядок = зависимости):
1. Токены (Foundations): `focus/ring` Day/Evening → `ink/900` (4); `chapter/techstack` Night → `ink/300` + проверка всех `chapter/*` ≥ 3:1 (5);
   `status/danger` Night → `red/300` #F07070 (20); `chapter/summary` → `ink/700` (2); обновить таблицу контрастов.
2. Компоненты: `Card/Metric Tone=accent` → surface-alt + полоса; `Rack/Server selected` → инверсия; чипы пути (2) · `Window/Shell`: max-height,
   sticky Header/Footer, скролл Content, `min-height 480`, пример «scrolled 720» (3) · мобильный футер 2 ряда (17) · `max-width 64ch` у Content (19) ·
   `Tag/Text` для прозаических чипов (15) · `Button/Icon` pause (6) · LangSwitch 44×28 / Icon на 768/390 (31) · `Field/*` состояния Sending/network/429/counter (26).
3. Экраны: подписи в баре 390 (имена глав по C2) + HTML-пины compact 36 на 34:709/56:1378/34:826 (1) · pause в верхних контролах 33:2, 34:1145 (6) ·
   `Hero Variant=laptop` 440×330 + clip + остров +40 px на 33:246 (11) · тема/язык только в баре, карточка бара = аватар + имя, бутылка без Contact (12) ·
   Monitoring ghost в Hero mobile и в баре 768 (7) · загрузка: карточка вправо + «Continue without 3D» (23) · offline-баннер полосой с × (24) ·
   маски на референс-PNG (22) · RU-экран 1280×720 + бар + Hero mobile (29).
4. Окна: Contact — одна Primary «Send message», CV → Secondary, футер без дублей (16) · стойки перекомпоновать (18) · имена глав в пинах/баре/aria (25) ·
   Tech stack mobile bottom-sheet (27) · Monitoring: live-строка, skeleton, offline, «0», «incl. you» (28) · Profile: фото 240×320 + «Looking for» (36).
5. Specs: §4/§5/§1 по п.1–2 (9); §3 порядок Tab (30); §1 prev/next поведение (32); §5 safe-area/dvh/scroll-lock (33); §2 пауза; §1 таймаут загрузки
   и offline-баннер; §1 Tech stack < 768; §7 — снять knownIssue danger, добавить R1–R4 как open.
После решений R1–R4 — второй короткий заход: Hero третья метрика + Hero mobile (13, 14), eyebrow во всех 8 окнах (21), вход в 30-sec (7/8), футеры 07/08 (10).
