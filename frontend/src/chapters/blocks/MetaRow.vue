<script setup lang="ts">
// Figma Meta/<LABEL>: подпись Label/Eyebrow + значение Body/Strong.
defineProps<{ label: string; value: string }>()
</script>

<template>
  <dl class="meta">
    <dt class="meta__label t-label-eyebrow">{{ label }}</dt>
    <dd class="meta__value t-body-strong">{{ value }}</dd>
  </dl>
</template>

<style scoped>
.meta {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-width: 64ch;
  margin: 0;
}

.meta__label {
  color: var(--text-secondary);
}

.meta__value {
  margin: 0;
  color: var(--text-primary);
}
</style>
