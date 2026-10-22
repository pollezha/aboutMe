<script setup lang="ts">
import { computed } from 'vue'
import type { Chapter } from './ChapterTag.vue'

const props = withDefaults(
  defineProps<{
    label: string
    value: string
    note: string
    size?: 'md' | 'sm'
    /** accent — полоса слева цветом главы (`chapter`); жёлтый не используется. */
    tone?: 'default' | 'accent'
    chapter?: Chapter
  }>(),
  { size: 'md', tone: 'default', chapter: 'prospace' },
)

const style = computed(() =>
  props.tone === 'accent' ? `--chapter: var(--chapter-${props.chapter})` : undefined,
)
</script>

<template>
  <div class="metric" :class="[`metric--${size}`, { 'metric--accent': tone === 'accent' }]" :style>
    <span class="metric__label t-label-eyebrow">{{ label }}</span>
    <span
      class="metric__value"
      :class="size === 'sm' ? 't-display-number-sm' : 't-display-number'"
      >{{ value }}</span
    >
    <span class="metric__note" :class="{ 't-body-small': size === 'md' }">{{ note }}</span>
  </div>
</template>

<style scoped>
.metric {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  box-sizing: border-box;
  border-radius: var(--radius-md);
  color: var(--text-primary);
  background: var(--bg-surface-alt);
}

.metric--md {
  min-width: 200px;
  min-height: 114px;
  padding: var(--space-4);
}

.metric--sm {
  min-width: 150px;
  min-height: 104px;
  padding: var(--space-3);
}

.metric--accent {
  border-left: 4px solid var(--chapter);
}

.metric__label {
  color: var(--text-secondary);
}

.metric--sm .metric__note {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  font-family: var(--font-text);
  font-size: var(--font-size-xs);
  line-height: 1.35;
  color: var(--text-secondary);
}
</style>
