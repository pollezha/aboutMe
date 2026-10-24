# Figma → код: окна глав 01–08 (снимок 2026-10-23)

Источник: Figma `1D6lW84rl4yYR8VQwV10Pp`, страница 🪟 Windows, узлы из `docs/design/figma-state.json` → `windows`.
Снят оркестратором скриптом (структура, text styles, токены, тексты). Данные для задач T2–T4 этапа 3
(`docs/plans/stage-3-site.md`). Цвета — только токены `src/theme/tokens.css` (`$bg/surface` → `--bg-surface`),
текст — классы `src/theme/typography.css` (`Body/Strong` → `.t-body-strong`). Тексты окон — это **контент**
(`content/en.json`, задача T1), не строки интерфейса; в коде их нет.

## Общий каркас — `Window/Shell` (уже в коде: `ChapterWindow.vue`)
- Desktop 1120 × min(640, 100vh − 48), min-height 480; mobile 390 × 100dvh. ChapterStripe 6 px `chapter/<id>`.
- Header (pad 24/32/16/32, gap 16): EyebrowRow = `Icon/sign-<x>` 20 px + Eyebrow `Label/Eyebrow` `text/secondary`;
  Title `Heading/Window` (mobile `Heading/Window-sm`); Subtitle `Body/Default` (mobile `Body/Small`) `text/secondary`;
  CloseButton `Button/Icon` 44. Eyebrow: «Stop N of 6 · <знак> · <подпись>» (R2); у 07/08 — без «Stop».
- Content (pad 8/32/16/32, mobile 8/16/16/16, gap 24, только он скроллится, текст max-width 64ch).
- Footer (`bg/surface-alt`, border-top `border/default`): слева Proof — `ProofLabel` «PROOF & LINKS» `Label/Eyebrow` +
  1–2 `Button/Ghost` с иконкой (external / download / arrow-right); справа Nav — `Prev` ghost «← 0N Name»
  (mobile: `Button/Icon` 44 с `aria-label="Previous: 0N Name"`), `Next` secondary «Next: 0N Name» + arrow-right
  (mobile: на всю ширину). Строго по 6 остановкам (R4): у 01 нет Prev, у 06 нет Next, у 07/08 Nav пуст.
- Mobile: все колонки складываются в одну, карточки метрик `Size=sm` по 2 в ряд (173 px), чипы переносятся.

## Повторяющиеся блоки (компоненты страницы Components)
| Блок | Структура | Vue (T2) |
|---|---|---|
| `Meta/<LABEL>` | V gap 4: Label `Label/Eyebrow` `text/secondary` + Value `Body/Strong` `text/primary` | `MetaRow` |
| `Chips` | H wrap gap 6; Chip = pad 4/12, r 8 (`--radius-sm`), `bg/surface-alt`; текст `Label/Caption` (языки, «good fit») или `Mono/Stack` (стек, курсы) | `ChipList :mono` |
| `List/KeyResult` | `<ul>`; строка H gap 12 pad 8/0: `Icon/check` 20 `status/success` (декоративная) + V gap 2: Result `Body/Strong`, How `Body/Small` `text/secondary` | `KeyResultList :items` |
| `Card/Metric` | есть (`MetricCard.vue`): md в окнах desktop, sm в mobile и в Profile/Monitoring; `Tone=accent` — полоса слева `chapter/<id>` | — |
| `Pill/Status` | есть (`StatusPill.vue`) | — |
| `Rack/Server` | H gap 12 pad 0/12 h 44 r 8: LED 8 `status/success` + Name `Mono/Stack` + Years `Mono/Stack-xs`. default `bg chapter/techstack`, текст `text/on-dark`; hover + border 2 `accent/primary`; selected `bg text/primary`, текст `bg/surface`, `Elevation/Pressed`; empty — не рендерить. `<button aria-pressed>` | `RackServer` (T3) |
| `Field/Input` / `Field/Textarea` | V gap 8: Label `Label/Caption`; Box pad 12/16 r 8 h 44 (textarea min 120) `bg/surface` border 1 `border/default`; focus — `focus/ring` 2; error — `status/danger` 2 + Help красным, `aria-invalid`/`aria-describedby`; Help `Body/Small` всегда в DOM | `FormField` (этап 4; в T4 — форма не рендерится, см. 06) |
| `Toast/Sent` | этап 4 | — |
| `Heading/Section` | заголовок секции внутри Content («Key results», «What I do», «Path of a click») | `<h3 class="t-heading-section">` |

## 01 Profile (28:276 / 28:372) · `chapter/profile` · `Icon/sign-licence`
- Eyebrow «Stop 1 of 6 · Driver licence · on the road since Jul 2024» (дата — из `experience[]`); Title «Yakov Polezhaev»;
  Subtitle «.NET backend developer · on the road since July 2024».
- Content: Columns gap 32 → ColA 176: PhotoPlaceholder 160×160 r 14 `bg/surface-alt` border 2 — **фото нет (решение
  2026-10-23: пропустить)** → блок не рендерить, ColB на всю ширину. ColB (V gap 20):
  `Meta/NAME` · `Meta/ON THE ROAD SINCE` «July 2024 · 2 yrs 3 mo in production» (считать из дат) ·
  `KEY NUMBERS` (Label + 3 × `Card/Metric sm`: те же `profile.highlights`, что в Hero) ·
  `Meta/ABOUT` «.NET backend developer. I own modules end to end: domain logic, data, messaging and the monitoring
  around them. 1000+ shipments a day went through my last module. I build with AI agents (Claude Code) every day.» ·
  `LANGUAGES` chips `Label/Caption`: EN B2 · CS B2 · DE A2 · RU native ·
  `Meta/LOOKING FOR` «Backend services with real load · .NET · remote or relocation in Europe».
- Footer Proof: «GitHub pollezha» (external), «Download CV (PDF, EN)» (download). Nav: Next: 02 ProSpace.

## 02 ProSpace (26:2 / 26:198, Night 31:1886) · `chapter/prospace` · `Icon/sign-waybill`
- Eyebrow «Stop 2 of 6 · Waybill · Latest role · Jan – Oct 2026» (период из `experience[]`, `to: null` → текущий
  месяц); Title «ProSpace · OptiTrack»; Subtitle «Backend Developer (.NET) · TMS for large cargo owners».
- Content: Metrics (H wrap gap 12, md): VOLUME 1000+ «shipments / day» `Tone=accent` · POSTGRESQL 200+ «tables» ·
  MY MODULE «Transport» «CREATED → PLANNED → IN TRANSIT → DELIVERED ✓» · (4-я метрика — **пропустить**, решение
  2026-10-23) → `H` «Key results» → `List/KeyResult` ×5:
  1. Built the transport module on my own — core service every shipment passes through · ASP.NET Core REST · 1000+ shipments/day
  2. Made audit logging extensible without touching business code — event-driven journaling of CRUD
  3. Found incident root causes and verified releases in production — Grafana, on call
  4. Owned technical decisions in my scope — architecture of new modules, specs with analysts, legacy refactoring, xUnit
  5. Built features with AI agents every day — Claude Code; set up the team's agent workflow: rules, prompts, MCP, skills
  → Columns: ColA `STACK` chips `Mono/Stack`: ASP.NET Core · EF Core · PostgreSQL · MongoDB · Kafka · SignalR · Kubernetes ·
  Grafana · Vue.js · Claude Code; ColB `Meta/TEAM` «cross-functional · code review · on-call».
  Placeholder «скриншоты продукта (NDA)» — **не рендерить** (нет данных).
- Footer Proof: «prospace.tech» (external, https://prospace.tech), «OptiTrack product page» (external — ссылка из
  контента; если нет URL — не показывать). Nav: ← 01 Profile · Next: 03 TimePath.

## 03 TimePath (29:395 / 29:564) · `chapter/timepath` · `Icon/sign-route`
- Eyebrow «Stop 3 of 6 · Route sheet · Previous role · Jul 2024 – Dec 2025»; Title «TimePath»; Subtitle «Backend
  Developer (.NET) · corporate platforms for energy and utilities».
- Content: Metrics ряд 1 (md): GRID SIZE · REGIONS «—» (**нет данных → карточку убрать**) · OBJECTS 7M+ «grid
  objects» · USERS 2000+ «platform users»; ряд 2: FILTER PAGE LOAD · BEFORE 40+ s «filtered on the client» ·
  AFTER < 2 s «filtering in optimised SQL» `Tone=accent` (полоса `chapter/timepath`, не prospace — в Figma
  унаследовано от компонента, в коде — цвет своей главы) · OUTPUT ~2× «faster to build on three projects»
  → «Key results» ×4:
  1. Cut a filter page from 40+ s to under 2 s — data was filtered on the client; moved filtering into optimised SQL
  2. Made new features ~2× faster to build on three projects — queues, files and shared logic into a platform core
  3. Hardened the platform — endpoint protection, RBAC, config encryption, bulk-export limits
  4. Supported sales and the team — demo stand, GitLab CI, reviewed interns' code
  → `STACK` chips: C# · ASP.NET Core · EF Core · PostgreSQL · SQL Server · RabbitMQ · SignalR · Docker · GitLab CI.
  Placeholder «reference letter» — не рендерить.
- Footer Proof: «timepath.ru» (external, https://timepath.ru), «Case: 40 s → 2 s» (arrow-right → открывает
  KeyResult #1 — в коде просто якорь внутри окна или не показывать). Nav: ← 02 ProSpace · Next: 04 Tech stack.

## 04 Tech stack (29:725 / 29:916, bottom-sheet 82:1875) · `chapter/techstack` · `Icon/sign-rack`
- Eyebrow «Stop 4 of 6 · Data center · 2024 – 2026»; Title «Tech stack»; Subtitle «Each rack is an area, each server a
  technology. Click a server to pull it out.»
- Content desktop: Columns gap 32 → ColA 614: `Racks` H wrap gap 12, Rack = V gap 8 pad 12 r 14 `bg/surface-alt`
  border 1 `border/default`, ширина 296 (2 в ряд), Title `Label/Eyebrow`; ColB 410: `ServerPanel` V gap 16 pad 16 r 14
  `bg/surface` border 2 `accent/primary`: Name `Heading/Section` · `Meta/EXPERIENCE` «2 y 3 m · since Jul 2024
  (computed from role dates)» · `Meta/WHERE I USED IT` · `Meta/WHAT I DID WITH IT`. Панель показывает выбранный
  сервер; по умолчанию выбран первый сервер первой стойки.
- Стойки и серверы (Years — считать из `usedIn` → `experience[]`; ⚠ Redis без срока — **убрать**, нет данных):
  BACKEND: C# / .NET · ASP.NET Core · EF Core · xUnit — DATA: PostgreSQL · SQL Server · MongoDB —
  MESSAGING: Kafka · RabbitMQ · SignalR — DEVOPS: Docker · Kubernetes · GitLab CI · Grafana — FRONTEND: Vue.js —
  AI AGENTS: Claude Code · MCP. Тексты панелей для каждого сервера — из концепта (`docs/concept/mockup-v6.html`,
  строки 1052–1075, поля `where`/`what`) + PostgreSQL из Figma: «Moved client-side filtering into optimised SQL
  (40+ s → < 2 s); schemas for new modules; EF Core migrations; query tuning in production.» Серверы с `[ADD]` в
  концепте (Quartz.NET, Redis, DDD, Clean Arch.) — не включать.
- Mobile (< 768): стойки в одну колонку (358); панель сервера — BottomSheet `role=dialog aria-labelledby=Name`,
  snap 60 % высоты, V gap 12 pad 8/16/24, `Elevation/Panel`, Handle 36×4 r 2 `border/default`; Header H gap 12:
  Name `Heading/Section` + Years `Mono/Stack` `text/secondary` + Close 44; Meta-блоки `Body/Default`; Scrim чёрный
  (клик закрывает); свайп вниз / Esc закрывают; у кнопки сервера `aria-expanded`; фокус — в sheet.
- Footer Proof: «GitHub pollezha», «Source of this site» (external → репозиторий). Nav: ← 03 TimePath · Next: 05 Education.

## 05 Education (30:899 / 30:1053) · `chapter/education` · `Icon/sign-diploma`
- Eyebrow «Stop 5 of 6 · Certificate · HSE University · 2021 – 2025»; Title «HSE University»; Subtitle «Bachelor of
  Business Informatics · Perm campus · 2025 BSc».
- Content: Columns gap 32, две колонки по 512. ColA: `Meta/PROGRAMME` «38.03.05 Business Informatics» ·
  `Meta/FORMAT` «Full-time · 4 years · 240 credits» · `Meta/GRADUATED` «June 2025» · `Meta/THESIS` ««Corporate
  Telegram bot for TimePath employees»» · `TEAM PROJECTS` (Label + `Body/Default` пункты «• HR system for the Perm
  Krai ambulance service», «• IS to optimise business processes»). Placeholder «Diploma PDF» — не рендерить.
  ColB: `COURSES` chips `Mono/Stack`: Web application development · excellent / Corporate information systems /
  Machine learning / Databases · good / Algorithms and data structures / Software design and architecture · in
  English / Requirements and IS design · `STUDY + WORK` пункты: «• Jul 2024 — joined TimePath while studying (3rd
  year)», «• Jun 2025 — graduated, BSc», «• 2026 — ProSpace, OptiTrack» · `LANGUAGES` chips `Mono/Stack`: Russian ·
  native / English · B2 / Czech · B2 / German · A2.
- Footer Proof: «perm.hse.ru» (external, https://perm.hse.ru); «Diploma (PDF) ⚠» — не показывать. Nav: ← 04 Tech stack ·
  Next: 06 Contact.

## 06 Contact (30:1200 / 30:1405) · `chapter/contact` · `Icon/sign-envelope`
- Eyebrow «Stop 6 of 6 · Destination · Your team»; Title «Next stop: your team.»; Subtitle «.NET backend developer
  looking for services with real load. Remote, or relocation in Europe.»
- Content: Columns gap 32. ColA 512 (V gap 20): `Meta/ROLE` «.NET Backend Developer · 2 yrs 3 mo in production»
  (стаж из дат) · `Status` Label «STATUS» + `Pill/Status` «Open to work · remote / relocation» · `Meta/BASED IN`
  «Serbia · CET · UTC+1» · `LANGUAGES` chips `Label/Caption` (EN B2 · CS B2 · DE A2 · RU native) ·
  `GOOD FIT IF YOU NEED` chips `Label/Caption`: Microservices on .NET · Event-driven systems · Kafka · SQL
  performance · On-call & monitoring · AI-assisted development · `SummaryLink` ghost «30-second summary» + arrow-right
  → открывает окно 07 (R3) · `Contacts` H wrap gap 8, все `Button/Secondary` с иконкой: «Download CV (PDF, EN)»
  (download, `/cv/Yakov_Polezhaev_CV_EN.pdf`), «Download CV (PDF, RU)» (`/cv/Yakov_Polezhaev_CV_RU.pdf`),
  «Telegram @poll_ezha» (telegram, https://t.me/poll_ezha), «GitHub pollezha» (github), «polezhaev.yasha@gmail.com»
  (email, mailto:). Ссылки — из `profile.links` контента.
  ColB 512: `Form/MessageInABottle` (V gap 16 pad 20 r 14 `bg/surface-alt`): H «Message in a bottle» · Field «Your
  name (optional)» · Field «Where to reply *» help «Email or @telegram · used only to reply to you» · Textarea
  «Message *» help «0 / 2000» · `Button/Primary` «Send message» на всю ширину. **Этап 3 (FR17 «до этапа 4»):** вместо
  формы — та же карточка с заголовком, одной строкой `Body/Default` «Until the mailbox is wired up, the fastest
  way is Telegram.» и одной `Button/Primary` «Write me on Telegram» (→ t.me). Это единственная primary-кнопка окна.
- Footer Proof: «30-second summary» (arrow-right → 07), «Source of this site» (external). Nav: ← 05 Education.

## 07 30-sec summary (31:1323 / 31:1453) · `chapter/summary` · `Icon/sign-summary` · deep-link `#summary`
- Eyebrow «Summary · 30 seconds»; Title «Yakov Polezhaev — .NET backend, open to work»; Subtitle «2 yrs 3 mo in
  production · Remote or relocation in Europe · EN B2 · Based in Serbia (CET)» (стаж из дат).
- Content: Metrics md ×3: SHIPMENTS / DAY 1000+ «through my last module (ProSpace, 2026)» `Tone=accent` · FILTER
  PAGE 40 s → 2 s «filtering moved into SQL (TimePath)» · IN PRODUCTION 2 y 3 m «since July 2024, two companies»
  → «What I do» → `List/KeyResult` ×5:
  1. Own backend modules end to end — domain logic, data, messaging, monitoring — ASP.NET Core, EF Core, PostgreSQL
  2. Event-driven systems — Kafka, RabbitMQ, SignalR; extensible audit logging without touching business code
  3. SQL performance — PostgreSQL, SQL Server — 40+ s → < 2 s on a filter page
  4. On-call & production — Grafana, incident root causes, release verification; Docker, Kubernetes, GitLab CI
  5. Build with AI agents every day — Claude Code; set up the team's agent workflow: rules, prompts, MCP, skills
  → `CTA` H wrap gap 8: `Button/Primary` «Contact» (→ окно 06), `Button/Secondary` «Download CV» + download.
- Footer Proof: «Download CV (PDF, EN)» (download), «Telegram @poll_ezha» (external). Nav: нет.

## 08 Monitoring (31:1577 / 31:1731) · `chapter/monitoring` · `Icon/sign-monitoring`
- Eyebrow «Monitoring · this site, live»; Title «Monitoring»; Subtitle «This site monitors itself. Every click becomes a
  Kafka event and comes back over SignalR.»
- Состояния (строка `StatusLine` `role=status aria-live=polite`, H gap 8: LED 8 + текст `Label/Caption`):
  live — LED `status/success` «live · updated 3 s ago»; skeleton — LED `border/default` «connecting…» + 3 полоски
  r 6 `border/default` (160/120/200 × 12); offline — LED `text/secondary` «offline · last known 12:40», счётчики
  держат последние известные значения, «0 events yet» когда событий нет. **Этап 3: только offline-состояние без
  сети** («offline · backend arrives with stage 4», значения «—»), ничего не запрашивать.
- Content: StatusLine → Metrics sm ×6 (6 в ряд desktop 166, mobile 2 в ряд): ON SITE NOW «live via SignalR» ·
  EVENTS TODAY «topic site.events.v1» · API P95 «gateway · last 5 min» · ERROR RATE «5xx · last 5 min» · CONSUMER
  LAG «group projector» · UPTIME «last 30 days» (значения в этапе 3 — «—») → `H` «Path of a click» → `Flow` H wrap
  gap 8 cx center: Step = pad 8/12 r 8 `Mono/Stack`; первый и последний `bg text/primary` + текст `bg/surface`,
  остальные `bg/surface-alt`: Your click → gateway → events-api → Kafka → projector + live-hub → SignalR → this
  board (между — `Icon/arrow-right` 18) → `H` «Logs · Metrics · Traces» → `Observability` H wrap gap 12, три
  `Meta/*` по 330: LOGS «Loki · structured JSON with TraceId · no IP / PII» · METRICS «Prometheus via OTel Collector ·
  RED per service» · TRACES «Tempo · one trace per click: gateway → events-api → Kafka → projector».
- Footer Proof: «Source of this site» (external), «30-second summary» (arrow-right → 07). Nav: нет.

## Иконки знаков
`frontend/src/shared/ui/icons/sign-{licence,waybill,route,rack,diploma,envelope,summary,monitoring}.svg` — экспорт из Figma
2026-10-23 (20×20, stroke 1.75, `currentColor`), имена добавлены в `IconName`. Цвет в EyebrowRow — `text/secondary`.
