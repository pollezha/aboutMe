<template>
  <span class="status-pill t-body-small">
    <span class="status-pill__dot" aria-hidden="true"></span>
    <slot />
  </span>
</template>

<style scoped>
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  color: var(--text-primary);
  background: var(--bg-surface-alt);
}

.status-pill__dot {
  flex: none;
  width: var(--space-2);
  height: var(--space-2);
  border-radius: var(--radius-full);
  background: var(--status-success);
}
</style>
