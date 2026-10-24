<script setup lang="ts">
import { computed } from 'vue'

export type Chapter =
  | 'profile'
  | 'prospace'
  | 'timepath'
  | 'techstack'
  | 'education'
  | 'contact'
  | 'monitoring'
  | 'summary'

const props = withDefaults(
  defineProps<{
    chapter: Chapter
    number: string
    title: string
    subtitle?: string
    as?: 'button' | 'div'
  }>(),
  { subtitle: undefined, as: 'button' },
)

// Цвет номера — контрастный к цвету главы в текущей теме (theme/pins.css, генерируется gen-theme).
const style = computed(
  () =>
    `--chapter: var(--chapter-${props.chapter}); ` +
    `--chapter-ink: var(--pin-ink-${props.chapter})`,
)
</script>

<template>
  <component
    :is="as"
    :type="as === 'button' ? 'button' : undefined"
    class="chapter-tag"
    :style="style"
  >
    <span class="chapter-tag__number t-label-caption">{{ number }}</span>
    <span class="chapter-tag__text">
      <span class="chapter-tag__title t-label-caption">{{ title }}</span>
      <span v-if="subtitle" class="chapter-tag__subtitle t-label-eyebrow">{{ subtitle }}</span>
    </span>
  </component>
</template>

<style scoped>
.chapter-tag {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--size-touch);
  padding: var(--space-1) var(--space-4) var(--space-1) var(--space-1);
  border: 0;
  border-radius: var(--radius-full);
  color: var(--text-primary);
  background: var(--bg-surface);
  box-shadow: var(--shadow-card);
  text-align: start;
}

button.chapter-tag {
  cursor: pointer;
}

button.chapter-tag:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: 2px;
}

.chapter-tag__number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: calc(var(--size-touch) - var(--space-2));
  height: calc(var(--size-touch) - var(--space-2));
  border-radius: var(--radius-full);
  color: var(--chapter-ink);
  background: var(--chapter);
}

.chapter-tag__text {
  display: flex;
  flex-direction: column;
}

.chapter-tag__subtitle {
  color: var(--text-secondary);
}
</style>
