<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import map from '../../scripts/design/figma-2d-map.json'
import type { ChapterId } from '../content/chapters'
import { useUiStore } from '../stores/ui'
import { ISLAND_RENDER_HEIGHT, ISLAND_RENDER_WIDTH, islandRenderUrl } from './render'

// 2D-режим (FR10): рендер острова в теме сайта + кнопки-хотспоты поверх (Figma Tablet 34:771, Phone 56:1398).
// Геометрия — проценты от рамки карты (figma-2d-map.json, сверена с рендером в framing.spec.ts).
// Картинка — LCP-элемент 2D-режима: fetchpriority=high, размеры заданы (без сдвига раскладки).

interface Hotspot {
  id: ChapterId
  index: string
  label: string
  left: number
  top: number
  width: number
  height: number
}

const props = withDefaults(
  defineProps<{
    variant: 'tablet' | 'phone'
    alt?: string
  }>(),
  { alt: 'Isometric island: each building is a chapter of the CV' },
)

const emit = defineEmits<{ open: [id: ChapterId] }>()

const ui = useUiStore()
const src = computed(() => islandRenderUrl(ui.theme))
const srcset = computed(() => `${islandRenderUrl(ui.theme)} 1x, ${islandRenderUrl(ui.theme, 2)} 2x`)

const hotspots = computed(() => map.hotspots[props.variant] as Hotspot[])
/** Имя кнопки: номер остановки и глава — как у подписи здания в 3D («02 ProSpace»). */
const nameOf = (spot: Hotspot) => (spot.index ? `${spot.index} ${spot.label}` : spot.label)

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
      :width="ISLAND_RENDER_WIDTH"
      :height="ISLAND_RENDER_HEIGHT"
      :alt="alt"
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
