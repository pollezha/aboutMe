<script setup lang="ts">
import { computed, useId } from 'vue'
import type { WindowMetric } from '../../../content'
import { type Chapter, MetricCard } from '../../../shared/ui'
import { useBreakpoint } from '../../../shared/lib'

// Figma Card/Metric в окнах: md на desktop, sm на mobile (по 2 в ряд); `size` фиксирует размер (Profile — sm).
const props = withDefaults(
  defineProps<{
    metrics: WindowMetric[]
    /** Цвет полосы accent-карточки — глава окна. */
    chapter: Chapter
    label?: string
    size?: 'md' | 'sm'
  }>(),
  { label: undefined, size: undefined },
)

const breakpoint = useBreakpoint()
const cardSize = computed(() => props.size ?? (breakpoint.value === 'mobile' ? 'sm' : 'md'))
const labelId = useId()
</script>

<template>
  <div
    class="metric-grid"
    :role="label ? 'group' : undefined"
    :aria-labelledby="label ? labelId : undefined"
  >
    <p v-if="label" :id="labelId" class="metric-grid__label t-label-eyebrow">{{ label }}</p>
    <div class="metric-grid__cards" :class="`metric-grid__cards--${cardSize}`">
      <MetricCard
        v-for="metric in metrics"
        :key="metric.label"
        :label="metric.label"
        :value="metric.value"
        :note="metric.note"
        :size="cardSize"
        :tone="metric.accent ? 'accent' : 'default'"
        :chapter="chapter"
      />
    </div>
  </div>
</template>

<style scoped>
.metric-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.metric-grid__label {
  margin: 0;
  color: var(--text-secondary);
}

.metric-grid__cards {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

@media (width < 768px) {
  .metric-grid__cards {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .metric-grid__cards > * {
    min-width: 0;
  }
}
</style>
