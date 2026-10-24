<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost'
    size?: 'md' | 'lg'
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
    /** 'a' — ссылка с теми же стилями (CV, Telegram). */
    as?: 'button' | 'a'
    href?: string
    target?: string
    rel?: string
  }>(),
  {
    variant: 'primary',
    size: 'md',
    disabled: false,
    type: 'button',
    as: 'button',
    href: undefined,
    target: undefined,
    rel: undefined,
  },
)

// Новая вкладка без доступа к window.opener.
const linkRel = computed(() => {
  const parts = new Set((props.rel ?? '').split(/\s+/).filter(Boolean))
  if (props.target === '_blank') parts.add('noopener')
  return parts.size > 0 ? [...parts].join(' ') : undefined
})

const classes = computed(() => [
  'btn',
  `btn--${props.variant}`,
  `btn--${props.size}`,
  props.size === 'lg' ? 't-body-strong' : 't-label-caption',
])
</script>

<template>
  <a v-if="as === 'a'" :class="classes" :href="href" :target="target" :rel="linkRel">
    <span class="btn__label"><slot /></span>
    <span v-if="$slots.icon" class="btn__icon"><slot name="icon" /></span>
  </a>
  <button
    v-else
    :type="type"
    :class="classes"
    :disabled="disabled"
    :aria-disabled="disabled ? 'true' : undefined"
  >
    <span class="btn__label"><slot /></span>
    <span v-if="$slots.icon" class="btn__icon"><slot name="icon" /></span>
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  box-sizing: border-box;
  padding: var(--space-3) var(--space-5);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--text-primary);
  background: transparent;
  text-decoration: none;
  cursor: pointer;
  transition:
    transform 0.12s ease,
    box-shadow 0.12s ease,
    background-color 0.12s ease;
}

.btn--md {
  height: var(--size-touch);
}

.btn--lg {
  height: calc(var(--size-touch) + var(--space-2));
}

.btn--primary {
  color: var(--text-on-accent);
  background: var(--accent);
  box-shadow: var(--shadow-pressed);
}

.btn--primary:hover {
  transform: translateY(-1px);
}

.btn--primary:active {
  transform: translateY(2px);
  box-shadow: 0 2px 0 var(--accent-shadow);
}

.btn--secondary {
  background: var(--bg-surface);
  border-color: var(--border);
}

.btn--secondary:hover,
.btn--ghost:hover {
  background: var(--bg-surface-alt);
}

.btn:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: 2px;
}

/* Двойное кольцо: в Night --focus-ring жёлтый, как и кнопка (1:1), — 2px surface внутри отделяет их. */
.btn--primary:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
  box-shadow:
    var(--shadow-pressed),
    0 0 0 2px var(--bg-surface);
}

.btn:disabled {
  opacity: 0.45;
  pointer-events: none;
}

.btn__icon {
  display: inline-flex;
  --icon-size: var(--space-5);
}

@media (prefers-reduced-motion: reduce) {
  .btn {
    transition: none;
  }

  .btn--primary:hover,
  .btn--primary:active {
    transform: none;
  }
}
</style>
