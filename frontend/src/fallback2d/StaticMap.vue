<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import map from '../../scripts/design/figma-2d-map.json'
import type { ChapterId } from '../content/chapters'
import { useChapterLabel } from '../i18n'

// 2D-режим (FR10): статичная картинка острова + кнопки-хотспоты поверх (Figma Tablet 34:771, Phone 56:1398).
// Геометрия — проценты от рамки карты, снимок figma-2d-map.json; имена хотспотов — подписи глав из i18n
// («Profile · About me»), а не `label` снимка (он только на английском).

interface Hotspot {
  id: ChapterId
  index: string
  left: number
  top: number
  width: number
  height: number
}

const props = withDefaults(
  defineProps<{
    variant: 'tablet' | 'phone'
    /** Рендер острова (этап 3); пока файла нет — видна заливка моря. */
    src?: string
  }>(),
  { src: '/img/island-day.webp' },
)

const emit = defineEmits<{ open: [id: ChapterId] }>()

const { t } = useI18n()
const chapterLabel = useChapterLabel()

const hotspots = computed(() =>
  (map.hotspots[props.variant] as Hotspot[]).map((spot) => {
    const { title, subtitle } = chapterLabel(spot.id)
    return { ...spot, label: `${title} · ${subtitle}` }
  }),
)
const imageFailed = ref(false)

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
      :alt="t('map.alt')"
      fetchpriority="high"
      @error="imageFailed = true"
    />
    <button
      v-for="spot in hotspots"
      :key="spot.id"
      type="button"
      class="hotspot"
      :aria-label="spot.label"
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
