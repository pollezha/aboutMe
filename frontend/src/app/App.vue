<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { BUILD_TIME, CONTENT_LANGS, contentFor, isChapterId } from '../content'
import { StaticMap } from '../fallback2d'
import { HeroHost } from '../hero'
import { useRouteLang } from '../locale'
import { SceneFallbackBanner, SceneHost, useViewMode } from '../mode'
import { RouteBar, useRouteStore } from '../route'
import { useBreakpoint } from '../shared/lib'
import { useTheme } from '../theme'
import { PrerenderedChapters, WindowHost } from '../windows'
import { useSiteHead } from './head'
import TopBar from './TopBar.vue'
import { useLayout } from './useLayout'

const route = useRouteStore()
const { store: langStore } = useRouteLang()
const { t } = useI18n()
const { store: themeStore, label: themeLabel } = useTheme(t)
const breakpoint = useBreakpoint()
const { store: ui, canSwitchMode, switchMode } = useViewMode(breakpoint)
const { layout, heroVariant, barVariant, mapVariant } = useLayout(toRef(ui, 'mode'), breakpoint)

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

// ?shot=island — только сцена, без HTML-слоя и подписей: кадр рендера острова для 2D-карты (npm run island).
const shot =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('shot') === 'island'

function open(id: string) {
  if (isChapterId(id)) route.openChapter(id)
}
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
      <TopBar
        :layout="layout"
        :can-switch-mode="canSwitchMode"
        :theme-label="themeLabel"
        @switch-mode="switchMode"
      />

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

    <WindowHost />
    <PrerenderedChapters />
  </div>
</template>

<style scoped>
.app {
  position: relative;
  min-height: 100dvh;
  color: var(--text-primary);
  background: var(--bg-canvas);
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
