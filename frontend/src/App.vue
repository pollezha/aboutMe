<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { CONTENT_LANGS, contentFor } from './content/bundles'
import { BUILD_TIME } from './content/buildTime'
import {
  CHAPTERS,
  ROUTE,
  chapterInfo,
  isChapterId,
  routeNeighbours,
  type ChapterId,
} from './content/chapters'
import { resolveHighlights } from './content/experience'
import { resolveChapter } from './content/format'
import StaticMap from './fallback2d/StaticMap.vue'
import { useSiteHead } from './head'
import { useChapterLabel, useLocaleSync } from './i18n'
import { langOf, pathFor } from './router'
import { SCENE_TIMEOUT_MS, loadSceneWhenIdle, type SceneLoad } from './scene'
import { MIN_3D_WIDTH, detectWebGL2, shouldUse3D } from './scene/shouldUse3D'
import { mapRotation } from './scene/useCamera'
import { isTheme, useUiStore, type Mode, type Theme } from './stores/ui'
import BottomBar, { type BottomBarStop } from './ui/BottomBar.vue'
import ChapterWindow from './ui/ChapterWindow.vue'
import HeroCard from './ui/HeroCard.vue'
import IconButton from './ui/IconButton.vue'
import SceneFallbackBanner from './ui/SceneFallbackBanner.vue'
import SceneLoading from './ui/SceneLoading.vue'
import { useBreakpoint } from './ui/useBreakpoint'
import { WINDOWS } from './ui/windows'
import ProofLinks from './ui/windows/blocks/ProofLinks.vue'

const ui = useUiStore()
const route = useRoute()
const router = useRouter()

// Язык страницы задаёт маршрут (/ или /ru/); переключатель (ui.setLang) меняет маршрут без перезагрузки.
const routeLang = computed(() => langOf(route.path))
watch(routeLang, (lang) => ui.syncLang(lang), { immediate: true })
watch(
  () => ui.lang,
  (lang) => {
    if (lang === routeLang.value) return
    const hash = typeof window !== 'undefined' ? window.location.hash : route.hash
    router.push({ path: pathFor(lang), query: route.query, hash })
  },
)

useLocaleSync()
const { t } = useI18n()
const breakpoint = useBreakpoint()

// Снимок контента на языке страницы (пока RU-контента нет — EN); загрузка из content-api — этап 4.
const content = computed(() => contentFor(ui.lang))
// Даты в тексте — от времени сборки: предрендер и клиент показывают одно и то же.
const now = BUILD_TIME

useSiteHead(() => ({
  content: content.value,
  langs: CONTENT_LANGS,
  origin: import.meta.env.VITE_SITE_ORIGIN,
  now,
}))

// Предрендер (vite-ssg): окна закрыты, но текст всех глав должен быть в HTML (FR11). Клиент монтирует
// приложение заново (без гидрации), поэтому этот блок есть только в статическом HTML и не дублирует окна.
const prerender = import.meta.env.SSR || typeof window === 'undefined'

const query = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null

// ?theme=night переопределяет сохранённую тему (ссылки на конкретную тему, скриншоты), но не запоминается.
const queryTheme = query?.get('theme') ?? null
if (isTheme(queryTheme)) ui.previewTheme(queryTheme)

// ?mode=2d|3d переопределяет сохранённый выбор на этот визит (ссылки, скриншоты), но не запоминается;
// 3D и по ссылке — только там, где оно возможно (ширина, WebGL). Кнопка переключения важнее ссылки.
const queryMode = query?.get('mode')
let urlMode: Mode | null = queryMode === '2d' || queryMode === '3d' ? queryMode : null

// ?shot=island — только сцена, без HTML-слоя и подписей: кадр рендера острова для 2D-карты (npm run island).
const shot = query?.get('shot') === 'island'

watch(() => ui.theme, ui.applyTheme, { immediate: true })

// Тот же предикат, что у CSS (width < 768px) и useBreakpoint: matchMedia, а не innerWidth
// (innerWidth включает полосу прокрутки и расходится с медиа-запросами на её ширину).
function isWide() {
  if (typeof window.matchMedia !== 'function') return window.innerWidth >= MIN_3D_WIDTH
  return window.matchMedia(`(min-width: ${MIN_3D_WIDTH}px)`).matches
}

// Сцена не загрузилась в этом визите — до перезагрузки страницы в 3D не возвращаемся (и при смене ширины).
const sceneFailed = ref(false)
const webgl = typeof window !== 'undefined' && detectWebGL2()

function use3D(userChoice: Mode | null) {
  if (typeof window === 'undefined' || sceneFailed.value) return false
  const nav = navigator as Navigator & { deviceMemory?: number }
  return shouldUse3D({
    width: isWide() ? MIN_3D_WIDTH : 0,
    webgl,
    deviceMemory: nav.deviceMemory,
    userChoice,
  })
}

function detectMode() {
  if (typeof window === 'undefined') return
  ui.setMode(use3D(urlMode ?? ui.userChoice) ? '3d' : '2d')
}

detectMode()
watch(breakpoint, detectMode)

// «Switch to 2D/3D» в верхних контролах: из 3D в 2D — всегда, из 2D в 3D — только если сцена здесь
// возможна (на ширине < 768, без WebGL2 или после сбоя сцены кнопки нет). Выбор запоминается.
const canSwitchMode = computed(
  () => breakpoint.value !== 'mobile' && (ui.mode === '3d' || use3D(null)),
)
const modeLabel = computed(() => (ui.mode === '3d' ? t('topBar.to2d') : t('topBar.to3d')))

function switchMode() {
  urlMode = null
  ui.chooseMode(ui.mode === '3d' ? '2d' : '3d')
}

// Сцена: ленивый чанк после простоя, таймаут → 2D с баннером (design §4 «Загрузка», UX9).
const sceneComponent = shallowRef<Component>()
let sceneLoad: SceneLoad | null = null
let sceneTimer: ReturnType<typeof setTimeout> | undefined

function stopSceneLoading() {
  sceneLoad?.cancel()
  sceneLoad = null
  clearTimeout(sceneTimer)
}

function startScene() {
  if (ui.mode !== '3d' || ui.sceneState === 'loading' || ui.sceneState === 'ready') return
  ui.setSceneState('loading')
  sceneTimer = setTimeout(failScene, SCENE_TIMEOUT_MS)
  if (sceneComponent.value) return
  const load = loadSceneWhenIdle()
  sceneLoad = load
  load.promise.then(
    (component) => {
      if (sceneLoad === load) sceneComponent.value = component
    },
    () => {
      if (sceneLoad === load) failScene()
    },
  )
}

function failScene() {
  if (ui.sceneState !== 'loading') return
  stopSceneLoading()
  sceneFailed.value = true
  ui.sceneTimedOut()
}

function onSceneReady() {
  if (ui.sceneState !== 'loading') return
  clearTimeout(sceneTimer)
  sceneLoad = null
  performance.mark?.('scene_ready')
  ui.setSceneState('ready')
}

function continueWithout3D() {
  stopSceneLoading()
  ui.continueWithout3D()
}

watch(
  () => ui.mode,
  (mode) => {
    if (mode === '3d') return startScene()
    stopSceneLoading()
    if (ui.sceneState !== 'failed') ui.setSceneState('idle')
  },
)

// overlay — Hero и бар поверх сцены (Figma Desktop 33:2, Laptop 33:246);
// stacked — колонка TopBar → Hero → карта, бар закреплён внизу (Figma Tablet 34:709, Phone 56:1378).
const layout = computed(() =>
  ui.mode === '3d' && (breakpoint.value === 'desktop' || breakpoint.value === 'laptop')
    ? 'overlay'
    : 'stacked',
)
const heroVariant = computed(() => {
  if (breakpoint.value === 'mobile') return 'mobile'
  // В колонке на планшете Hero во всю ширину с десктопной типографикой (Figma Tablet 34:709).
  return layout.value === 'overlay' && breakpoint.value === 'laptop' ? 'laptop' : 'desktop'
})
const barVariant = computed(() => {
  if (breakpoint.value === 'mobile') return undefined // 2D-бар 72 px (медиа-запрос в BottomBar)
  return breakpoint.value === 'desktop' && layout.value === 'overlay' ? 'desktop' : 'compact'
})
const mapVariant = computed(() => (breakpoint.value === 'mobile' ? 'phone' : 'tablet'))

const profile = computed(() => ({
  name: t('hero.name'),
  role: t('hero.role'),
  status: content.value.profile.status,
  workFormat: content.value.profile.workFormat,
  location: content.value.profile.locationShort,
}))
const highlights = computed(() => resolveHighlights(content.value, now))
// CV и Telegram — из ссылок бандла: на /ru/ ведут на RU-PDF и подписаны по-русски.
const cvLink = computed(() => content.value.profile.links.find((link) => link.kind === 'cv'))
const telegramLink = computed(() =>
  content.value.profile.links.find((link) => link.kind === 'telegram'),
)
const links = computed(() => ({ cv: cvLink.value?.href, telegram: telegramLink.value?.href }))
const barProfile = computed(() => ({ initials: 'YP', name: t('hero.name'), role: t('hero.role') }))

const chapterLabel = useChapterLabel()
const stops = computed<BottomBarStop[]>(() =>
  ROUTE.map((chapter) => ({
    ...chapter,
    ...chapterLabel(chapter.id),
    // Активная важнее посещённой: у текущей главы — заливка, у уже просмотренных — галочка.
    state:
      ui.activeStop === chapter.id
        ? 'active'
        : ui.visitedStops.has(chapter.id)
          ? 'visited'
          : 'default',
  })),
)

// Три темы по кругу — не toggle, поэтому без aria-pressed: в имени текущая и следующая тема.
const NEXT_THEME: Record<Theme, Theme> = { day: 'evening', evening: 'night', night: 'day' }
const themeLabel = computed(() =>
  t('theme.label', { current: t(`theme.${ui.theme}`), next: t(`theme.${NEXT_THEME[ui.theme]}`) }),
)
// Кнопка языка — когда есть контент на обоих языках (FR8); имя — текущий язык и куда переключит.
const showLang = CONTENT_LANGS.length > 1

function open(id: string) {
  if (isChapterId(id)) ui.openChapter(id)
}

const windowChapter = computed(() => (ui.openWindow ? chapterInfo(ui.openWindow) : null))
// Шапка и подвал окна — из контента главы (даты подставлены); тело — из реестра окон.
const windowText = computed(() =>
  ui.openWindow ? resolveChapter(content.value, ui.openWindow, now) : null,
)
const chapterTexts = computed(() =>
  prerender ? CHAPTERS.map(({ id }) => ({ id, ...resolveChapter(content.value, id, now) })) : [],
)
const windowEyebrow = computed(() => {
  if (!windowChapter.value || !windowText.value) return ''
  const { index } = windowChapter.value
  // «Stop N of 6 · …» (R2) — только у остановок маршрута.
  if (!index) return windowText.value.eyebrow
  const stop = t('window.stop', { n: Number(index), total: ROUTE.length })
  return `${stop} · ${windowText.value.eyebrow}`
})
const neighbours = computed(() => (ui.openWindow ? routeNeighbours(ui.openWindow) : {}))
const prevLink = computed(() => {
  const prev = neighbours.value.prev
  return prev ? { number: prev.index, title: chapterLabel(prev.id).title } : undefined
})
const nextLink = computed(() => {
  const next = neighbours.value.next
  return next ? { number: next.index, title: chapterLabel(next.id).title } : undefined
})

// Окно ↔ URL-хэш (#prospace) и история (design §4 «Окна»): ссылку на главу можно отправить,
// «Назад» закрывает окно. Открытие из UI — новая запись истории с state.chapter, prev/next — замена
// этой записи. Запись, открытую по ссылке (#contact), считаем чужой: закрытие лишь убирает хэш.
function ownsHistoryEntry() {
  return typeof (history.state as { chapter?: unknown } | null)?.chapter === 'string'
}

function urlWith(id: ChapterId | null) {
  const { pathname, search } = window.location
  return `${pathname}${search}${id ? `#${id}` : ''}`
}

function onWindowOpen(value: boolean) {
  if (value) return
  ui.closeWindow()
  // Своя запись — уходим с неё; окно уже закрыто, popstate придёт на запись без главы.
  if (ownsHistoryEntry()) history.back()
}

watch(
  () => ui.openWindow,
  (id, previous) => {
    const target = id ? `#${id}` : ''
    if (window.location.hash === target) return
    if (id && !previous) {
      history.pushState({ chapter: id }, '', urlWith(id))
    } else if (id) {
      const state = ownsHistoryEntry() ? { chapter: id } : history.state
      history.replaceState(state, '', urlWith(id))
    } else if (!ownsHistoryEntry()) {
      // Своя запись снимается history.back() в onWindowOpen; чужая — только теряет хэш.
      history.replaceState(history.state, '', urlWith(null))
    }
  },
)

/** Хэш главы открывает её окно; пустой или чужой хэш закрывает окно (Назад, ручная правка URL). */
function syncFromLocation() {
  const id = window.location.hash.slice(1)
  if (isChapterId(id)) {
    if (ui.openWindow !== id) ui.openChapter(id)
  } else if (ui.openWindow) {
    ui.closeWindow()
  }
}

onMounted(() => {
  startScene()
  syncFromLocation()
  window.addEventListener('popstate', syncFromLocation)
  window.addEventListener('hashchange', syncFromLocation)
})

onBeforeUnmount(() => {
  stopSceneLoading()
  window.removeEventListener('popstate', syncFromLocation)
  window.removeEventListener('hashchange', syncFromLocation)
})
</script>

<template>
  <div
    class="app"
    :class="[`app--${ui.mode}`, `app--${layout}`, `app--${breakpoint}`, { 'app--shot': shot }]"
    :data-theme="ui.theme"
  >
    <div v-if="ui.mode === '3d' && sceneComponent" class="scene-layer">
      <component
        :is="sceneComponent"
        :framing="shot ? 'island' : 'overlay'"
        @ready="onSceneReady"
      />
    </div>
    <!-- Заглушка под сценой: плавно уходит, когда сцена нарисовала первый кадр. -->
    <Transition name="scene-fade">
      <div
        v-if="!shot && ui.mode === '3d' && ui.sceneState !== 'ready'"
        class="scene-placeholder"
        aria-hidden="true"
      />
    </Transition>
    <SceneLoading
      v-if="!shot && ui.mode === '3d' && ui.sceneState === 'loading'"
      class="app__scene-loading"
      @skip="continueWithout3D"
    />

    <template v-if="!shot">
      <header class="top-bar">
        <span v-if="layout === 'stacked'" class="top-bar__brand t-label-caption">
          YP · .NET backend
        </span>
        <div class="top-bar__actions">
          <IconButton
            v-if="ui.mode === '3d'"
            class="top-bar__rotate"
            icon="rotate"
            :label="t('topBar.rotate')"
            :title="t('topBar.rotateHint')"
            @click="mapRotation.rotate()"
          />
          <IconButton
            v-if="ui.mode === '3d'"
            :icon="ui.motionPaused ? 'play' : 'pause'"
            :label="t('topBar.pause')"
            :pressed="ui.motionPaused"
            @click="ui.toggleMotion()"
          />
          <IconButton
            v-if="canSwitchMode"
            class="top-bar__mode"
            icon="map"
            :label="modeLabel"
            :title="modeLabel"
            @click="switchMode"
          />
          <IconButton
            v-if="layout === 'stacked'"
            icon="theme"
            :label="themeLabel"
            @click="ui.cycleTheme()"
          />
          <IconButton
            v-if="layout === 'stacked' && showLang"
            icon="lang"
            :label="t('lang.label')"
            @click="ui.toggleLang()"
          />
        </div>
      </header>

      <main class="app__main">
        <SceneFallbackBanner
          v-if="ui.sceneState === 'failed'"
          class="app__scene-banner"
          @dismiss="ui.dismissSceneBanner()"
        />
        <HeroCard
          class="app__hero"
          :variant="heroVariant"
          :profile="profile"
          :highlights="highlights"
          :links="links"
          :contact-label="t('hero.contact')"
          :cv-label="cvLink?.label ?? ''"
          :telegram-label="telegramLink?.label ?? ''"
          @contact="ui.openChapter('contact')"
        />
        <StaticMap v-if="ui.mode === '2d'" class="app__map" :variant="mapVariant" @open="open" />
      </main>

      <BottomBar
        class="app__bar"
        :variant="barVariant"
        :stops="stops"
        :profile="barProfile"
        :nav-label="t('bar.nav')"
        :contact-label="t('bar.contact')"
        :monitoring-label="t('bar.monitoring')"
        :theme-label="themeLabel"
        :lang-label="t('lang.label')"
        :show-lang="showLang"
        @open="open"
        @contact="ui.openChapter('contact')"
        @monitoring="ui.openChapter('monitoring')"
        @toggle-theme="ui.cycleTheme()"
        @toggle-lang="ui.toggleLang()"
      />
    </template>

    <ChapterWindow
      v-if="windowChapter && windowText"
      :open="true"
      :chapter="windowChapter.id"
      :number="windowChapter.index"
      :eyebrow="windowEyebrow"
      :sign="WINDOWS[windowChapter.id].sign"
      :title="windowText.title"
      :subtitle="windowText.subtitle"
      :prev="prevLink"
      :next="nextLink"
      :close-label="t('window.close')"
      :links-label="t('window.links')"
      :next-label="t('window.next')"
      @update:open="onWindowOpen"
      @prev="neighbours.prev && ui.openChapter(neighbours.prev.id)"
      @next="neighbours.next && ui.openChapter(neighbours.next.id)"
    >
      <component :is="WINDOWS[windowChapter.id].body" :content="content" :now="now" />
      <template #links><ProofLinks :links="windowText.proofLinks" /></template>
    </ChapterWindow>

    <section v-if="prerender" id="chapters" hidden>
      <article v-for="chapter in chapterTexts" :id="`chapter-${chapter.id}`" :key="chapter.id">
        <p>{{ chapter.eyebrow }}</p>
        <h2>{{ chapter.title }}</h2>
        <p v-if="chapter.subtitle">{{ chapter.subtitle }}</p>
        <component :is="WINDOWS[chapter.id].body" :content="content" :now="now" />
        <ProofLinks :links="chapter.proofLinks" />
      </article>
    </section>
  </div>
</template>

<style scoped>
.app {
  position: relative;
  min-height: 100dvh;
  color: var(--text-primary);
  background: var(--bg-canvas);
}

/* Сцена и заглушка под HTML-слоем; заглушка (небо темы) уходит после первого кадра сцены. */
.scene-layer,
.scene-placeholder {
  position: fixed;
  inset: 0;
}

.scene-placeholder {
  background: var(--scene-sky);
}

.scene-fade-leave-active {
  transition: opacity 0.4s ease;
}

.scene-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .scene-fade-leave-active {
    transition: none;
  }
}

/* Figma LoadingCard 34:1119: справа внизу над баром, не над Hero. */
.app__scene-loading {
  position: fixed;
  right: var(--edge);
  bottom: calc(var(--size-bottom-bar) + var(--space-8));
  z-index: 2;
  max-width: calc(100vw - 2 * var(--edge));
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.top-bar__brand {
  font-weight: 700;
}

.top-bar__actions {
  display: flex;
  gap: var(--space-2);
}

.app__main {
  display: contents;
}

/* ---------- overlay: HTML-слой поверх сцены (Figma Desktop 33:2, Laptop 33:246) ---------- */
.app--overlay {
  /* Figma: Hero и кнопки в 32 от края (laptop 24), бар в 16 от низа. */
  --edge: var(--space-8);
  --edge-bottom: var(--space-4);

  height: 100dvh;
  overflow: hidden;
}

.app--overlay.app--laptop {
  --edge: var(--space-6);
}

.app--overlay .top-bar {
  position: absolute;
  top: var(--edge);
  right: var(--edge);
  z-index: 1;
}

.app--overlay .app__hero {
  position: absolute;
  top: var(--edge);
  left: var(--edge);
  z-index: 1;
}

.app--overlay .app__bar {
  position: absolute;
  right: var(--edge);
  bottom: var(--edge-bottom);
  left: var(--edge);
  z-index: 1;
  width: auto;
  margin: 0 auto;
}

/* ---------- stacked: TopBar → Hero → карта, бар закреплён внизу (Figma Tablet 34:709, Phone 56:1378) ---------- */
.app--stacked {
  --edge: var(--space-4);
  --column: 736px;

  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  box-sizing: border-box;
  padding: var(--space-4) var(--edge) calc(104px + var(--space-8));
}

.app--stacked.app--mobile {
  gap: var(--space-3);
  padding-bottom: calc(72px + var(--space-4) + env(safe-area-inset-bottom));
}

.app--stacked .top-bar,
.app--stacked .app__scene-banner,
.app--stacked .app__hero,
.app--stacked .app__map {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: var(--column);
}

.app--stacked .top-bar {
  min-height: var(--size-touch);
}

.app--stacked:not(.app--mobile) .app__bar {
  position: fixed;
  right: var(--edge);
  bottom: var(--space-4);
  left: var(--edge);
  z-index: 10;
  width: auto;
  max-width: var(--column);
  margin: 0 auto;

  --route-stop-width: 72px;
}

/* В колонке бар без профиля и переключателей: тема (и язык с этапа 3) — в TopBar (Figma Tablet 34:709). */
.app--stacked .app__bar :deep(.bottom-bar__profile),
.app--stacked .app__bar :deep(.bottom-bar__actions .icon-btn) {
  display: none;
}
</style>
