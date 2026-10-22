<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost'
    size?: 'md' | 'lg'
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
  }>(),
  { variant: 'primary', size: 'md', disabled: false, type: 'button' },
)
</script>

<template>
  <button
    :type="type"
    class="btn"
    :class="[
      `btn--${variant}`,
      `btn--${size}`,
      size === 'lg' ? 't-body-strong' : 't-label-caption',
    ]"
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
  padding: var(--space-3) var(--space-5);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--text-primary);
  background: transparent;
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
