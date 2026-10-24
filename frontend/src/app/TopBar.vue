<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { CONTENT_LANGS } from '../content'
import { useLangStore } from '../locale'
import { mapRotation, useModeStore } from '../mode'
import { useRouteStore } from '../route'
import { IconButton } from '../shared/ui'
import { useThemeStore } from '../theme'
import type { Layout } from './useLayout'

// Верхние контролы: кнопки модулей (поворот и режим — mode, пауза — route, тема — theme, язык — locale).
// Выбор режима и подпись темы решают useViewMode и useTheme в App.vue оболочки:
// у них побочные эффекты, вызываются по разу.
defineProps<{ layout: Layout; canSwitchMode: boolean; themeLabel: string }>()
defineEmits<{ 'switch-mode': [] }>()

const { t } = useI18n()
const mode = useModeStore()
const route = useRouteStore()
const theme = useThemeStore()
const lang = useLangStore()

// «Switch to 2D/3D» в верхних контролах.
const modeLabel = computed(() => (mode.mode === '3d' ? t('topBar.to2d') : t('topBar.to3d')))

// Кнопка языка в верхних контролах — когда есть контент на обоих языках (FR8); в баре её показывает RouteBar.
const showLang = CONTENT_LANGS.length > 1
</script>

<template>
  <header class="top-bar">
    <span v-if="layout === 'stacked'" class="top-bar__brand t-label-caption">
      YP · .NET backend
    </span>
    <div class="top-bar__actions">
      <IconButton
        v-if="mode.mode === '3d'"
        class="top-bar__rotate"
        icon="rotate"
        :label="t('topBar.rotate')"
        :title="t('topBar.rotateHint')"
        @click="mapRotation.rotate()"
      />
      <IconButton
        v-if="mode.mode === '3d'"
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
        @click="$emit('switch-mode')"
      />
      <IconButton
        v-if="layout === 'stacked'"
        icon="theme"
        :label="themeLabel"
        @click="theme.cycleTheme()"
      />
      <IconButton
        v-if="layout === 'stacked' && showLang"
        icon="lang"
        :label="t('lang.label')"
        @click="lang.toggleLang()"
      />
    </div>
  </header>
</template>

<style scoped>
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
</style>
