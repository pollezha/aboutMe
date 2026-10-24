<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import map from '../../scripts/design/figma-2d-map.json'
import type { ChapterId } from '../content'
import { useChapterLabel } from '../i18n'
import { useThemeStore } from '../theme'
import { ISLAND_RENDER_HEIGHT, ISLAND_RENDER_WIDTH, islandRenderUrl } from './render'

// 2D-режим (FR10): рендер острова в теме сайта + кнопки-хотспоты поверх (Figma Tablet 34:771, Phone 56:1398).
// Геометрия — проценты от рамки карты (figma-2d-map.json, сверена с рендером в framing.spec.ts); имена
// хотспотов — подписи глав из i18n, а не `label` снимка (он только на английском).
// Картинка — LCP-элемент 2D-режима: fetchpriority=high, размеры заданы (без сдвига раскладки).

interface Hotspot {
  id: ChapterId
  index: string
  left: number
  top: number
  width: number
  height: number
}

const props = defineProps<{ variant: 'tablet' | 'phone' }>()

const emit = defineEmits<{ open: [id: ChapterId] }>()

const { t } = useI18n()
const chapterLabel = useChapterLabel()
const themeStore = useThemeStore()
const src = computed(() => islandRenderUrl(themeStore.theme))
// Ширины рендеров, а не плотности: браузер берёт 1x, пока его хватает на ширину карты × DPR (телефон с DPR < 2
// не качает @2x). Карта не шире колонки 736 px; на телефоне — во всю ширину окна (cover в квадрате).
const srcset = computed(
  () =>
    `${islandRenderUrl(themeStore.theme)} ${ISLAND_RENDER_WIDTH}w, ${islandRenderUrl(themeStore.theme, 2)} ${ISLAND_RENDER_WIDTH * 2}w`,
)
const SIZES = '(min-width: 768px) 736px, 100vw'

const hotspots = computed(() =>
  (map.hotspots[props.variant] as Hotspot[]).map((spot) => {
    const { title, subtitle } = chapterLabel(spot.id)
    return { ...spot, label: `${title} · ${subtitle}` }
  }),
)
/** Имя кнопки: номер остановки и глава — как у подписи здания в 3D («02 ProSpace · Latest role»). */
const nameOf = (spot: Hotspot & { label: string }) =>
  spot.index ? `${spot.index} ${spot.label}` : spot.label

// Нет файла — видна заливка моря; у другой темы своя картинка, пробуем её заново.
const imageFailed = ref(false)
watch(src, () => (imageFailed.value = false))

function boxStyle(spot: Hotspot) {
  return {
    left: `${spot.left}%`,
    top: `${spot.top}%`,
    width: `${spot.width}%`,
    height: `${spot.height}%`,
  }
}
</script>

<template>
  <div class="static-map" :class="`static-map--${variant}`">
    <img
      v-if="!imageFailed"
      class="static-map__image"
      :src="src"
      :srcset="srcset"
      :sizes="SIZES"
      :width="ISLAND_RENDER_WIDTH"
      :height="ISLAND_RENDER_HEIGHT"
      :alt="t('map.alt')"
      fetchpriority="high"
      decoding="async"
      @error="imageFailed = true"
    />
    <button
      v-for="spot in hotspots"
      :key="spot.id"
      type="button"
      class="hotspot"
      :aria-label="nameOf(spot)"
      :style="boxStyle(spot)"
      @click="emit('open', spot.id)"
    >
      <span
        class="pin t-mono-stack"
        :style="`--chapter: var(--chapter-${spot.id}); --pin-ink: var(--pin-ink-${spot.id})`"
        aria-hidden="true"
      >
        <template v-if="spot.index">{{ spot.index }}</template>
        <span v-else class="pin__dot"></span>
      </span>
    </button>
  </div>
</template>

<style scoped>
.static-map {
  position: relative;
  overflow: hidden;
  width: 100%;
  border-radius: var(--radius-lg);
  background: var(--scene-sea);
  box-shadow: var(--shadow-card);
}

.static-map--tablet {
  aspect-ratio: 736 / 666;
}

.static-map--phone {
  aspect-ratio: 1 / 1;
}

.static-map__image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hotspot {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-width: var(--size-touch);
  min-height: var(--size-touch);
  padding: 0;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  cursor: pointer;
}

.hotspot:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: 2px;
}

/* Pin/Compact (Figma 75:515): круг 36 цветом главы с номером; цвет номера — theme/pins.css. */
.pin {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  color: var(--pin-ink);
  background: var(--chapter);
  box-shadow: var(--shadow-card);
  font-weight: 700;
  transition: transform 0.12s ease;
}

.hotspot:hover .pin {
  transform: scale(1.08);
}

.pin__dot {
  width: var(--space-3);
  height: var(--space-3);
  border: 2px solid var(--pin-ink);
  border-radius: var(--radius-full);
}

@media (prefers-reduced-motion: reduce) {
  .pin {
    transition: none;
  }

  .hotspot:hover .pin {
    transform: none;
  }
}
</style>
