<script lang="ts">
import type { RouteStopState } from './RouteStop.vue'

export interface BottomBarStop {
  id: string
  index: string
  title: string
  subtitle: string
  state: RouteStopState
}

export interface BottomBarProfile {
  initials: string
  name: string
  /** Должность без стажа (стаж — только в метрике Hero). */
  role: string
}
</script>

<script setup lang="ts">
import BaseButton from './BaseButton.vue'
import IconButton from './IconButton.vue'
import RouteStop from './RouteStop.vue'

withDefaults(
  defineProps<{
    stops: BottomBarStop[]
    profile: BottomBarProfile
    /** Без значения — по ширине окна: ≥ 1366 desktop, 768–1365 compact, < 768 — 2D-бар внизу. */
    variant?: 'desktop' | 'compact'
    /** Кнопка языка — только когда есть контент на обоих языках (FR8). */
    showLang?: boolean
    /** Подписи — строки интерфейса из i18n (контейнер), компонент языка не знает. */
    navLabel: string
    contactLabel: string
    monitoringLabel: string
    themeLabel: string
    langLabel: string
  }>(),
  { variant: undefined, showLang: false },
)

const emit = defineEmits<{
  open: [id: string]
  contact: []
  monitoring: []
  toggleTheme: []
  toggleLang: []
}>()
</script>

<template>
  <nav class="bottom-bar" :class="`bottom-bar--${variant ?? 'auto'}`" :aria-label="navLabel">
    <div class="bottom-bar__profile">
      <span class="bottom-bar__avatar t-heading-section" aria-hidden="true">{{
        profile.initials
      }}</span>
      <span class="bottom-bar__who">
        <span class="t-body-strong">{{ profile.name }}</span>
        <span class="bottom-bar__role t-body-small">{{ profile.role }}</span>
      </span>
    </div>

    <div class="bottom-bar__route">
      <span class="bottom-bar__road" aria-hidden="true"></span>
      <ol class="bottom-bar__stops">
        <li v-for="stop in stops" :key="stop.id">
          <RouteStop
            :index="stop.index"
            :title="stop.title"
            :subtitle="stop.subtitle"
            :state="stop.state"
            @open="emit('open', stop.id)"
          />
        </li>
      </ol>
    </div>

    <div class="bottom-bar__actions">
      <BaseButton variant="primary" @click="emit('contact')">{{ contactLabel }}</BaseButton>
      <BaseButton variant="ghost" @click="emit('monitoring')">{{ monitoringLabel }}</BaseButton>
      <IconButton icon="theme" :label="themeLabel" @click="emit('toggleTheme')" />
      <IconButton v-if="showLang" icon="lang" :label="langLabel" @click="emit('toggleLang')" />
    </div>
  </nav>
</template>

<style scoped>
.bottom-bar {
  /* desktop (Figma 19:270) */
  --bar-height: var(--size-bottom-bar);
  --bar-px: var(--space-6);
  --bar-py: var(--space-4);
  --bar-gap: var(--space-6);
  --avatar-size: 56px;
  --route-stop-width: 96px;
  --route-stop-circle: 36px;

  display: flex;
  align-items: center;
  gap: var(--bar-gap);
  box-sizing: border-box;
  width: 100%;
  max-width: 1376px;
  height: var(--bar-height);
  padding: var(--bar-py) var(--bar-px);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  background: var(--bg-surface);
  box-shadow: var(--shadow-panel);
}

/* compact (Figma 19:369) */
.bottom-bar--compact {
  --bar-height: 104px;
  --bar-px: var(--space-5);
  --bar-py: var(--space-3);
  --bar-gap: var(--space-5);
  --avatar-size: 44px;
  --route-stop-width: 88px;
}

@media (width < 1366px) {
  .bottom-bar--auto {
    --bar-height: 104px;
    --bar-px: var(--space-5);
    --bar-py: var(--space-3);
    --bar-gap: var(--space-5);
    --avatar-size: 44px;
    --route-stop-width: 88px;
  }
}

.bottom-bar__profile {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex: none;
}

.bottom-bar__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: var(--avatar-size);
  height: var(--avatar-size);
  border-radius: var(--radius-full);
  color: var(--text-on-accent);
  background: var(--accent);
}

.bottom-bar__who {
  display: flex;
  flex-direction: column;
}

.bottom-bar__role {
  color: var(--text-secondary);
}

.bottom-bar__route {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
}

/* Пунктирная «дорога» от центра первого до центра последнего кружка. */
.bottom-bar__road {
  position: absolute;
  top: calc(var(--space-2) + var(--route-stop-circle) / 2 - 1.5px);
  right: calc(var(--route-stop-width) / 2);
  left: calc(var(--route-stop-width) / 2);
  border-top: 3px dashed color-mix(in srgb, var(--text-primary) 55%, transparent);
}

.bottom-bar__stops {
  position: relative;
  display: flex;
  justify-content: space-between;
  margin: 0;
  padding: 0;
  list-style: none;
}

.bottom-bar__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: none;
}

/* < 768: 2D-бар 72 px внизу экрана (Screens/Phone 56:1408); Contact/Monitoring — в Hero, тема/язык — в TopBar. */
@media (width < 768px) {
  .bottom-bar--auto {
    --bar-height: 72px;
    --bar-px: var(--space-3);
    --bar-py: var(--space-1);
    --route-stop-circle: 44px;
    --route-stop-width: 56px;

    /* Высота растёт на safe-area: бар не уходит под индикатор «домой» (viewport-fit=cover). */
    height: auto;
    min-height: 72px;
    padding-bottom: calc(var(--space-1) + env(safe-area-inset-bottom));
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 10;
    max-width: none;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }

  .bottom-bar--auto .bottom-bar__profile,
  .bottom-bar--auto .bottom-bar__actions {
    display: none;
  }

  .bottom-bar--auto .bottom-bar__road {
    top: calc(var(--route-stop-circle) / 2 - 1.5px);
  }

  .bottom-bar--auto :deep(.route-stop) {
    gap: 0;
    padding: 0;
  }

  /* Остановка 56 px: длинное слово переносится по слогам, где браузер умеет (lang страницы), UX16. */
  .bottom-bar--auto :deep(.route-stop__title) {
    font-size: var(--font-size-xs);
    hyphens: auto;
  }

  .bottom-bar--auto :deep(.route-stop__subtitle) {
    display: none;
  }
}
</style>
