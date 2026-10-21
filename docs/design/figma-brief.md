# Figma: бриф на сборку дизайн-документа

Файл: https://www.figma.com/design/1D6lW84rl4yYR8VQwV10Pp · состояние: `docs/design/figma-state.json` (ID всех сущностей).
Цель файла: документ, по которому фронтенд (Vue 3 + TresJS, см. `docs/design/architecture.md` §4) собирается
без вопросов к дизайнеру. Источник требований: `docs/spec/portfolio-mvp.md` (FR1–FR17, NFR1–NFR3),
разбор концепта `docs/concept/design-review.md` (D1–D25), контент — `content/en.json` и тексты концепта (ниже).

## Правила (из design-review и спеки)
- Текст ≥ 12 px; подписи 14; основной 16. Контраст текст/фон ≥ 4,5:1 — только пары из Semantic-переменных.
- Два шрифта: Bricolage Grotesque (текст), IBM Plex Mono (цифры/стек). Все тексты — через text styles.
- Все цвета/радиусы/отступы — через переменные (Semantic, Layout). Никаких «голых» hex в компонентах.
- Жёлтый `accent/primary` — только для CTA и фокуса. Акцент главы (`chapter/*`) — фон/полоса/метка, не цвет текста.
- Окно открывается сразу по клику (≤ 600 мс), грузовик едет фоном (D5). Окна — модальные диалоги: Esc, фокус.
- 2D-режим на ширине < 768 и без WebGL: статичная карта + те же два способа навигации, что на десктопе —
  нижняя панель и клик по зданию (хотспоты поверх картинки); окна на весь экран (FR10). **Никаких списков
  глав/пилюль как третьего меню** (решение пользователя 2026-10-21).
- Reduced motion: все бесконечные анимации отключаются (D10).
- Монетизация внимания: первый экран без кликов показывает имя, роль, стаж (из дат), статус, формат, локацию,
  Contact, CV, Telegram + 3 цифры (D2, FR1).

## Страницы и что на них
1. **📘 Cover** — название, версия, статус «in review», дата, ссылки: репо, спека, дизайн-док; легенда страниц.
2. **🚀 Getting started** — как читать файл: где токены, как темы (режим коллекции Semantic), как именуются
   компоненты (`Category/Name`, варианты `State=…`), соответствие переменных CSS (`var(--…)`), что считать
   источником истины (Figma → `frontend/src/theme/palette.ts`).
3. **🎨 Foundations** — специмен: таблица Semantic-цветов по 3 режимам с ratio контраста к `bg/surface`
   (цифрой в подписи), типографика (все стили с размером/интерлиньяжем), отступы и радиусы, тени, сетка
   брейкпоинтов (1440 / 1280×720 / 768 / 390 с колонками и полями), иконки (набор ≤ 12: arrow, external,
   close, play/pause, theme, lang, rotate, email, telegram, github, download, check).
4. **🧩 Components** (каждый — ComponentSet с вариантами, auto-layout, привязки к переменным, описание):
   - `Button/Primary` (жёлтая CTA с «толщиной» 4 px): Size=md|lg × State=default|hover|focus|disabled.
   - `Button/Secondary` (surface + border), `Button/Ghost`: State=default|hover|focus|disabled.
   - `Button/Icon` (44×44, тема/поворот/закрыть): State.
   - `Tag/Chapter` (цветная метка с номером и подписью, как пин на карте): Chapter=profile…monitoring.
   - `Pill/Status` («● Open to work», success на surface-alt).
   - `Route/Stop` (остановка нижней панели: номер, название, подпись): State=default|active|visited|hover|focus.
   - `BottomBar` (профиль-карточка + Route×6 + CTA Contact/30-sec/Monitoring + тема/язык): Variant=desktop|compact.
   - `Hero/FirstScreen` (левый верхний блок: имя, роль, стаж, статус, формат, локация, EN/RU, CV, Telegram,
     3 цифры): Variant=desktop|mobile.
   - `Window/Shell` (каркас окна: eyebrow «EXIT 0N · …» с chapter-акцентом, заголовок, подзаголовок, кнопка
     закрыть, зона контента, футер «Proof & links», prev/next): Variant=desktop|mobile.
   - `Card/Metric` (большая цифра + подпись), `List/KeyResult` (строка «результат — как»), `Field/Input`,
     `Field/Textarea` (State=default|focus|error|disabled), `Rack/Server` (стойка и сервер для Tech stack:
     State=default|hover|selected|empty), `Toast/Sent`.
5. **🪟 Windows** — 8 окон на `Window/Shell` с реальным контентом (см. ниже), десктоп 1120×640 (влезает в
   1280×720 с полями) и мобильный 390 (на весь экран). Темы: Day; один пример Night.
6. **🖥 Screens** — первый экран: Desktop 1440×900, Laptop 1280×720, Tablet 768×1024 (2D-режим), Phone 390×844
   (2D-режим) × Day; плюс 1440 Night и Evening. Сцена на экранах — PNG-референс из концепта (3:58), обрезанный,
   с пометкой «3D-сцена: см. референс», HTML-слой поверх — компонентами.
   Состояния: загрузка сцены (заглушка-картинка + панель), API офлайн (баннер), reduced-motion (пометка).
7. **📝 Specs** — поведение (клик по остановке → окно сразу; грузовик фоном; поворот 90°; смена темы/языка;
   Esc/фокус; prev/next), анимации (длительности, easing, что отключать), доступность (порядок Tab, aria),
   таблица «компонент → Vue-компонент → CSS-переменные» для фронта, 2D-fallback правила.
8. **🧪 Concept (reference)** — уже есть, не трогать.

## Контент окон (из концепта; `[ADD]` оставить как явный плейсхолдер «⚠ нужны данные»)
- **01 Profile · DRIVER LICENCE · CLASS .NET BACKEND**: фото `[ADD]`; NAME Yakov Polezhaev; ON THE ROAD SINCE
  July 2024 · стаж (из дат); ABOUT «.NET backend developer. I own modules end to end: domain logic, data,
  messaging and the monitoring around them. 1000+ shipments a day went through my last module. I build with
  AI agents (Claude Code) every day.»; LANGUAGES EN B2 · CS B2 · DE A2 · RU native.
- **02 ProSpace · OptiTrack · WAYBILL № 02 · LATEST ROLE · JAN – OCT 2026**: Backend Developer (.NET) · TMS for
  large cargo owners; VOLUME 1000+ / day; POSTGRESQL 200+ tables; MY MODULE Transport (статусы CREATED →
  PLANNED → IN TRANSIT → DELIVERED ✓); результаты: «Built the transport module on my own — core service every
  shipment passes through, ASP.NET Core REST, 1000+ shipments/day»; «Made audit logging extensible without
  touching business code — event-driven journaling of CRUD»; «Found incident root causes and verified releases
  in production — Grafana, on call»; «Owned technical decisions in my scope — architecture of new modules,
  specs with analysts, legacy refactoring, xUnit»; «Built features with AI agents every day — Claude Code;
  set up the team's agent workflow: rules, prompts, MCP, skills». STACK: ASP.NET Core, EF Core, PostgreSQL,
  MongoDB, Kafka, SignalR, Kubernetes, Grafana, Vue.js, Claude Code. TEAM: cross-functional, code review, on-call.
  Метрика `[ADD]`. Proof: prospace.tech, OptiTrack product page, screenshots (NDA-safe) `[ADD]`.
- **03 TimePath · EXIT 03 · PREVIOUS ROLE · JUL 2024 – DEC 2025 · 1 YR 6 MO**: Backend Developer (.NET) ·
  corporate platforms for energy and utilities; GRID SIZE: regions 7M+? (в концепте «regions | 7M+ | objects |
  2000+ | users» — оформить как 3 метрики: regions, 7M+ objects, 2000+ users); STACK C#, ASP.NET Core, EF Core,
  PostgreSQL, SQL Server, RabbitMQ, SignalR, Docker, GitLab CI; KEY RESULTS: «Cut a filter page from 40+ s to
  under 2 s — data was filtered on the client; moved filtering into optimised SQL»; «Made new features ~2×
  faster to build on three projects — queues, files and shared logic into a platform core»; «Hardened the
  platform — endpoint protection, RBAC, config encryption, bulk-export limits»; «Supported sales and the team
  — demo stand, GitLab CI, reviewed interns' code». Метрики: FILTER PAGE LOAD BEFORE 40+ s → AFTER <2 s; OUTPUT
  ~2×. Proof: timepath.ru, case write-up «40 s → 2 s», reference letter.
- **04 Tech stack · EXIT 04 · DATA CENTER**: «Each rack is an area, each server a technology. Click a server to
  pull it out.» Стойки: BACKEND (C#/.NET, ASP.NET Core, EF Core, …), DATA (PostgreSQL, SQL Server, MongoDB,
  Redis), MESSAGING (Kafka, RabbitMQ, SignalR), DEVOPS (Docker, Kubernetes, GitLab CI, Grafana), FRONTEND
  (Vue.js), AI AGENTS (Claude Code, MCP). Панель выбранного сервера: EXPERIENCE (срок из дат), WHERE I USED IT,
  WHAT I DID WITH IT. Пустые серверы не показывать (D23).
- **05 Education · EXIT 05 · CERTIFICATE OF EDUCATION**: HSE University · Bachelor of Business Informatics ·
  Perm campus · 2025 BSc; Programme 38.03.05; Full-time · 4 years · 240 credits; Graduated June 2025; THESIS
  «Corporate Telegram bot for TimePath employees»; COURSES: Web application development (excellent), Corporate
  information systems, Machine learning, Databases (good), Algorithms and data structures, Software design and
  architecture (taught in English), Requirements and IS design; TEAM PROJECTS: HR system for the Perm Krai
  ambulance service; IS to optimise business processes; STUDY + WORK timeline Jul 2024 / Jun 2025 / 2026;
  LANGUAGES Russian native, English, Czech, German. Proof: Diploma PDF `[ADD]`, perm.hse.ru, transcript `[ADD]`.
- **06 Contact · EXIT 06 · DESTINATION · «Next stop: your team.»**: «.NET backend developer looking for services
  with real load. Remote, or relocation in Europe.»; ROLE .NET Backend Developer · стаж in production; STATUS
  ● Open to work · Remote or relocation; BASED IN Serbia · CET · UTC+1; EN B2 · CS B2 · DE A2 · RU native; GOOD
  FIT IF YOU NEED: Microservices on .NET · Event-driven systems · Kafka · SQL performance · On-call & monitoring
  · AI-assisted development; Telegram @poll_ezha; email `[ADD: адрес для EN]`; GitHub pollezha; Download CV;
  форма «Message in a bottle» (Your name / Where to reply / Message / Throw the bottle; «Your contact is used
  only to reply to you»); состояние SENT «The bottle is on its way».
- **30-sec summary**: hero-строка + 3 цифры (1000+ shipments/day · 40 s → 2 s · стаж) + 4 строки «что умею»
  + CTA Contact/CV.
- **Monitoring · «Control tower» · THIS SITE, IN REAL TIME**: «This site monitors itself. Every click becomes a
  Kafka event and comes back over SignalR.» Метрики: ON SITE NOW, EVENTS TODAY, API P95, ERROR RATE, CONSUMER
  LAG, UPTIME (только агрегаты, без ленты). PATH OF A CLICK: Your click → gateway → events-api → Kafka →
  projector + live-hub → SignalR → this board. LOGS / METRICS / TRACES. Ссылки: «Source of this site» (репо),
  без публичной Grafana (D18).

## Что нужно вернуть
Отчёт ≤ 60 строк: созданные страницы/компоненты/окна/экраны с node-id (обновить `figma-state.json`),
скриншоты ключевых страниц (ссылки/пути), что не удалось и почему, список решений, требующих пользователя.
