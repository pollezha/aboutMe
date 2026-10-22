<script setup lang="ts">
import { computed } from 'vue'
import Icon from './Icon.vue'
import type { IconName } from './icon-registry'

const props = withDefaults(
  defineProps<{
    icon: IconName
    /** Обязателен: единственное доступное имя кнопки без текста. */
    label: string
    /** Задаётся только для toggle-кнопок (например, тема) → aria-pressed. */
    pressed?: boolean
    /** 'a' — ссылка с теми же стилями (Telegram в Hero). */
    as?: 'button' | 'a'
    href?: string
    target?: string
    rel?: string
  }>(),
  { pressed: undefined, as: 'button', href: undefined, target: undefined, rel: undefined },
)

if (import.meta.env.DEV && !props.label) {
  console.error(`[IconButton] "label" is required (icon "${props.icon}"): it becomes aria-label`)
}

// Новая вкладка без доступа к window.opener (как у BaseButton).
const linkRel = computed(() => {
  const parts = new Set((props.rel ?? '').split(/\s+/).filter(Boolean))
  if (props.target === '_blank') parts.add('noopener')
  return parts.size > 0 ? [...parts].join(' ') : undefined
})
</script>

<template>
  <a
    v-if="as === 'a'"
    class="icon-btn"
    :href="href"
    :target="target"
    :rel="linkRel"
    :aria-label="label || undefined"
  >
    <Icon :name="icon" />
  </a>
  <button
    v-else
    type="button"
    class="icon-btn"
    :aria-label="label || undefined"
    :aria-pressed="pressed"
  >
    <Icon :name="icon" />
  </button>
</template>

<style scoped>
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  box-sizing: border-box;
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
