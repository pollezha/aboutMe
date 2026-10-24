<script setup lang="ts">
import { Icon } from '../shared/ui'

export type RouteStopState = 'default' | 'active' | 'visited'

withDefaults(
  defineProps<{
    /** Двузначный номер главы: '01'…'06'. */
    index: string
    title: string
    subtitle?: string
    state?: RouteStopState
  }>(),
  { subtitle: undefined, state: 'default' },
)

const emit = defineEmits<{ open: [] }>()
</script>

<template>
  <button
    type="button"
    class="route-stop"
    :class="`route-stop--${state}`"
    :aria-current="state === 'active' ? 'step' : undefined"
    @click="emit('open')"
  >
    <span class="route-stop__circle">
      <Icon v-if="state === 'visited'" name="check" class="route-stop__check" />
      <span v-else class="route-stop__index t-mono-stack">{{ index }}</span>
    </span>
    <span class="route-stop__title t-label-caption">{{ title }}</span>
    <span v-if="subtitle" class="route-stop__subtitle">{{ subtitle }}</span>
  </button>
</template>

<style scoped>
/* Ширину и диаметр задаёт контейнер (BottomBar): --route-stop-width, --route-stop-circle. */
.route-stop {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  flex: none;
  width: var(--route-stop-width, 96px);
  padding: var(--space-2) 0;
  border: 0;
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  background: transparent;
  text-align: center;
  cursor: pointer;
}

.route-stop:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 0;
}

.route-stop__circle {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: var(--route-stop-circle, 36px);
  height: var(--route-stop-circle, 36px);
  border: 2px solid var(--border);
  border-radius: var(--radius-full);
  background: var(--bg-surface);
  transition:
    background-color 0.12s ease,
    border-color 0.12s ease;
}

.route-stop:hover .route-stop__circle {
  border-color: var(--text-primary);
  background: var(--bg-surface-alt);
}

.route-stop__index {
  font-weight: 700;
  font-size: var(--font-size-xs);
  line-height: 1;
  color: var(--text-secondary);
}

.route-stop--active .route-stop__circle {
  border-color: var(--accent);
  background: var(--accent);
  box-shadow: var(--shadow-pressed);
}

.route-stop--active .route-stop__index {
  color: var(--text-on-accent);
}

.route-stop--visited .route-stop__circle {
  background: var(--bg-surface-alt);
}

.route-stop__check {
  --icon-size: 18px;

  color: var(--status-success);
}

.route-stop__subtitle {
  font-family: var(--font-text);
  font-size: var(--font-size-xs);
  line-height: 1.2;
  color: var(--text-secondary);
}

@media (prefers-reduced-motion: reduce) {
  .route-stop__circle {
    transition: none;
  }
}
</style>
