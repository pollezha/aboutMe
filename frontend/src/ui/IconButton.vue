<script setup lang="ts">
import Icon from './Icon.vue'
import type { IconName } from './icon-registry'

const props = withDefaults(
  defineProps<{
    icon: IconName
    /** Обязателен: единственное доступное имя кнопки без текста. */
    label: string
    /** Задаётся только для toggle-кнопок (например, тема) → aria-pressed. */
    pressed?: boolean
  }>(),
  { pressed: undefined },
)

if (import.meta.env.DEV && !props.label) {
  console.error(`[IconButton] "label" is required (icon "${props.icon}"): it becomes aria-label`)
}
</script>

<template>
  <button type="button" class="icon-btn" :aria-label="label || undefined" :aria-pressed="pressed">
    <Icon :name="icon" />
  </button>
</template>

<style scoped>
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: var(--size-touch);
  height: var(--size-touch);
  padding: 0;
  border: 0;
  border-radius: var(--radius-full);
  color: var(--bg-surface);
  background: var(--text-primary);
  cursor: pointer;
  --icon-size: var(--space-5);
}

.icon-btn:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: 2px;
}
</style>
