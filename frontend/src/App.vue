<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  BUILD_TIME,
  CHAPTERS,
  CONTENT_LANGS,
  ROUTE,
  chapterInfo,
  contentFor,
  isChapterId,
  resolveChapter,
  routeNeighbours,
  type ChapterId,
} from './content'
import { WINDOWS } from './chapters'
import { StaticMap } from './fallback2d'
import { useSiteHead } from './head'
import { HeroHost } from './hero'
import { useChapterLabel, useRouteLang } from './locale'
import { SceneFallbackBanner, SceneHost, mapRotation, useViewMode } from './mode'
import { RouteBar, useRouteStore } from './route'
import { useBreakpoint } from './shared/lib'
import { IconButton } from './shared/ui'
import { useTheme } from './theme'
import { ChapterWindow, ProofLinks } from './windows'

const route = useRouteStore()
const { store: langStore } = useRouteLang()
const { t } = useI18n()
const { store: themeStore, label: themeLabel } = useTheme(t)
const breakpoint = useBreakpoint()
const { store: ui, canSwitchMode, switchMode } = useViewMode(breakpoint)

// Снимок контента на языке страницы (пока RU-контента нет — EN); загрузка из content-api — этап 4.
const content = computed(() => contentFor(langStore.lang))
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

// ?shot=island — только сцена, без HTML-слоя и подписей: кадр рендера острова для 2D-карты (npm run island).
const shot = query?.get('shot') === 'island'

// «Switch to 2D/3D» в верхних контролах (режим и кнопку решает useViewMode).
const modeLabel = computed(() => (ui.mode === '3d' ? t('topBar.to2d') : t('topBar.to3d')))

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

const chapterLabel = useChapterLabel()
// Кнопка языка в верхних контролах — когда есть контент на обоих языках (FR8); в баре её показывает RouteBar.
const showLang = CONTENT_LANGS.length > 1

function open(id: string) {
  if (isChapterId(id)) route.openChapter(id)
}

const windowChapter = computed(() => (route.openWindow ? chapterInfo(route.openWindow) : null))
// Шапка и подвал окна — из контента главы (даты подставлены); тело — из реестра окон.
const windowText = computed(() =>
  route.openWindow ? resolveChapter(content.value, route.openWindow, now) : null,
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
const neighbours = computed(() => (route.openWindow ? routeNeighbours(route.openWindow) : {}))
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
  route.closeWindow()
  // Своя запись — уходим с неё; окно уже закрыто, popstate придёт на запись без главы.
  if (ownsHistoryEntry()) history.back()
}

watch(
  () => route.openWindow,
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
    if (route.openWindow !== id) route.openChapter(id)
  } else if (route.openWindow) {
    route.closeWindow()
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
    :class="[`app--${ui.mode}`, `app--${layout}`, `app--${breakpoint}`, { 'app--shot': shot }]"
    :data-theme="themeStore.theme"
  >
    <!-- Сцена, заглушка и карточка загрузки (design §4 «Загрузка»): ленивый чанк сразу после монтирования. -->
    <SceneHost :shot="shot" />

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
            :icon="route.motionPaused ? 'play' : 'pause'"
            :label="t('topBar.pause')"
            :pressed="route.motionPaused"
            @click="route.toggleMotion()"
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
            @click="themeStore.cycleTheme()"
          />
          <IconButton
            v-if="layout === 'stacked' && showLang"
            icon="lang"
            :label="t('lang.label')"
            @click="langStore.toggleLang()"
          />
        </div>
      </header>

      <main class="app__main">
        <SceneFallbackBanner
          v-if="ui.sceneState === 'failed'"
          class="app__scene-banner"
          @dismiss="ui.dismissSceneBanner()"
        />
        <HeroHost
          class="app__hero"
          :variant="heroVariant"
          @contact="route.openChapter('contact')"
        />
        <StaticMap v-if="ui.mode === '2d'" class="app__map" :variant="mapVariant" @open="open" />
      </main>

      <RouteBar
        class="app__bar"
        :variant="barVariant"
        :theme-label="themeLabel"
        @toggle-theme="themeStore.cycleTheme()"
        @toggle-lang="langStore.toggleLang()"
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
      @prev="neighbours.prev && route.openChapter(neighbours.prev.id)"
      @next="neighbours.next && route.openChapter(neighbours.next.id)"
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
