<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import en from '../../content/en.json'
import {
  ROUTE,
  chapterInfo,
  isChapterId,
  routeNeighbours,
  type ChapterId,
} from './content/chapters'
import { resolveHighlights } from './content/experience'
import { resolveChapter } from './content/format'
import type { ContentBundle } from './content/types'
import StaticMap from './fallback2d/StaticMap.vue'
import { useLocaleSync } from './i18n'
import { MIN_3D_WIDTH, detectWebGL2, shouldUse3D } from './scene/shouldUse3D'
import { isTheme, useUiStore, type Theme } from './stores/ui'
import BottomBar, { type BottomBarStop } from './ui/BottomBar.vue'
import ChapterWindow from './ui/ChapterWindow.vue'
import HeroCard from './ui/HeroCard.vue'
import IconButton from './ui/IconButton.vue'
import { useBreakpoint } from './ui/useBreakpoint'
import { WINDOWS } from './ui/windows'
import ProofLinks from './ui/windows/blocks/ProofLinks.vue'

useLocaleSync()
const { t } = useI18n()
const ui = useUiStore()
const breakpoint = useBreakpoint()

// Снимок контента EN; RU-контент и загрузка из content-api — этап 3.
const content = en as ContentBundle

// ?theme=night переопределяет сохранённую тему (ссылки на конкретную тему, скриншоты), но не запоминается.
if (typeof window !== 'undefined') {
  const queryTheme = new URLSearchParams(window.location.search).get('theme')
  if (isTheme(queryTheme)) ui.previewTheme(queryTheme)
}

watch(() => ui.theme, ui.applyTheme, { immediate: true })

// Тот же предикат, что у CSS (width < 768px) и useBreakpoint: matchMedia, а не innerWidth
// (innerWidth включает полосу прокрутки и расходится с медиа-запросами на её ширину).
function isWide() {
  if (typeof window.matchMedia !== 'function') return window.innerWidth >= MIN_3D_WIDTH
  return window.matchMedia(`(min-width: ${MIN_3D_WIDTH}px)`).matches
}

function detectMode() {
  if (typeof window === 'undefined') return
  const nav = navigator as Navigator & { deviceMemory?: number }
  const use3D = shouldUse3D({
    width: isWide() ? MIN_3D_WIDTH : 0,
    webgl: detectWebGL2(),
    deviceMemory: nav.deviceMemory,
    userChoice: null,
  })
  ui.setMode(use3D ? '3d' : '2d')
}

detectMode()
watch(breakpoint, detectMode)

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
  status: content.profile.status,
  workFormat: content.profile.workFormat,
  location: content.profile.locationShort,
}))
const highlights = resolveHighlights(content)
const links = {
  cv: content.profile.links.find((link) => link.kind === 'cv')?.href,
  telegram: content.profile.links.find((link) => link.kind === 'telegram')?.href,
}
const barProfile = computed(() => ({ initials: 'YP', name: t('hero.name'), role: t('hero.role') }))

const stops = computed<BottomBarStop[]>(() =>
  ROUTE.map((chapter) => ({
    ...chapter,
    state: ui.activeStop === chapter.id ? 'active' : 'default',
  })),
)

// Три темы по кругу — не toggle, поэтому без aria-pressed: в имени текущая и следующая тема.
const NEXT_THEME: Record<Theme, Theme> = { day: 'evening', evening: 'night', night: 'day' }
const themeLabel = computed(() => `Theme: ${ui.theme}. Switch to ${NEXT_THEME[ui.theme]}`)

function open(id: string) {
  if (isChapterId(id)) ui.openChapter(id)
}

const windowChapter = computed(() => (ui.openWindow ? chapterInfo(ui.openWindow) : null))
// Шапка и подвал окна — из контента главы (даты подставлены); тело — из реестра окон.
const windowText = computed(() => (ui.openWindow ? resolveChapter(content, ui.openWindow) : null))
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
  return prev ? { number: prev.index, title: prev.title } : undefined
})
const nextLink = computed(() => {
  const next = neighbours.value.next
  return next ? { number: next.index, title: next.title } : undefined
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
  syncFromLocation()
  window.addEventListener('popstate', syncFromLocation)
  window.addEventListener('hashchange', syncFromLocation)
})

onBeforeUnmount(() => {
  window.removeEventListener('popstate', syncFromLocation)
  window.removeEventListener('hashchange', syncFromLocation)
})
</script>

<template>
  <div
    class="app"
    :class="[`app--${ui.mode}`, `app--${layout}`, `app--${breakpoint}`]"
    :data-theme="ui.theme"
  >
    <div v-if="ui.mode === '3d'" class="scene-placeholder" aria-hidden="true">
      <span class="scene-placeholder__caption t-mono-stack">3D scene — stage 3</span>
    </div>

    <header class="top-bar">
      <span v-if="layout === 'stacked'" class="top-bar__brand t-label-caption">
        YP · .NET backend
      </span>
      <div class="top-bar__actions">
        <IconButton
          v-if="layout === 'overlay'"
          class="top-bar__rotate"
          icon="rotate"
          label="Rotate map (coming soon)"
          disabled
        />
        <IconButton
          v-if="ui.mode === '3d'"
          :icon="ui.motionPaused ? 'play' : 'pause'"
          label="Pause animation"
          :pressed="ui.motionPaused"
          @click="ui.toggleMotion()"
        />
        <!-- Кнопка языка — с RU-контентом (этап 3, FR8). -->
        <IconButton
          v-if="layout === 'stacked'"
          icon="theme"
          :label="themeLabel"
          @click="ui.cycleTheme()"
        />
      </div>
    </header>

    <main class="app__main">
      <HeroCard
        class="app__hero"
        :variant="heroVariant"
        :profile="profile"
        :highlights="highlights"
        :links="links"
        @contact="ui.openChapter('contact')"
      />
      <StaticMap v-if="ui.mode === '2d'" class="app__map" :variant="mapVariant" @open="open" />
    </main>

    <BottomBar
      class="app__bar"
      :variant="barVariant"
      :stops="stops"
      :profile="barProfile"
      :theme-label="themeLabel"
      :show-lang="false"
      @open="open"
      @contact="ui.openChapter('contact')"
      @monitoring="ui.openChapter('monitoring')"
      @toggle-theme="ui.cycleTheme()"
      @toggle-lang="ui.toggleLang()"
    />

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
      @update:open="onWindowOpen"
      @prev="neighbours.prev && ui.openChapter(neighbours.prev.id)"
      @next="neighbours.next && ui.openChapter(neighbours.next.id)"
    >
      <component :is="WINDOWS[windowChapter.id].body" :content="content" />
      <template #links><ProofLinks :links="windowText.proofLinks" /></template>
    </ChapterWindow>
  </div>
</template>

<style scoped>
.app {
  position: relative;
  min-height: 100dvh;
  color: var(--text-primary);
  background: var(--bg-canvas);
}

/* Заглушка сцены под HTML-слоем (этап 3 — TresJS). */
.scene-placeholder {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--scene-sky);
}

.scene-placeholder__caption {
  color: var(--text-primary);
  opacity: 0.6;
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

.top-bar__rotate:disabled {
  opacity: 0.45;
  cursor: default;
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
