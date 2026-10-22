<script setup lang="ts">
// Figma Rack/Server: LED + имя + срок. Toggle-кнопка выбора; на телефоне ещё и раскрывает bottom-sheet.
withDefaults(
  defineProps<{
    name: string
    term: string
    pressed: boolean
    /** Только на телефоне (sheet) → aria-expanded; на desktop не задаётся. */
    expanded?: boolean
    focusable: boolean
  }>(),
  { expanded: undefined },
)
</script>

<template>
  <button
    type="button"
    class="rack-server"
    :aria-pressed="pressed"
    :aria-expanded="expanded"
    :tabindex="focusable ? 0 : -1"
  >
    <span class="rack-server__led" aria-hidden="true"></span>
    <span class="rack-server__name t-mono-stack">{{ name }}</span>
    <span class="rack-server__term t-mono-stack">{{ term }}</span>
  </button>
</template>

<style scoped>
.rack-server {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  box-sizing: border-box;
  width: 100%;
  min-height: var(--size-touch);
  padding: 0 var(--space-3);
  border: 2px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--text-on-dark);
  background: var(--chapter-techstack);
  text-align: start;
  cursor: pointer;
}

.rack-server:hover {
  border-color: var(--accent);
}

.rack-server[aria-pressed='true'] {
  color: var(--bg-surface);
  background: var(--text-primary);
  box-shadow: var(--shadow-pressed);
}

.rack-server:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: 2px;
}

.rack-server__led {
  flex: none;
  width: var(--space-2);
  height: var(--space-2);
  border-radius: var(--radius-full);
  background: var(--status-success);
}

.rack-server__name {
  flex: 1;
  min-width: 0;
}

/* Mono/Stack-xs: в typography.css нет отдельного класса — моно 12 px поверх Mono/Stack. */
.rack-server__term {
  flex: none;
  font-size: 12px;
}
</style>
