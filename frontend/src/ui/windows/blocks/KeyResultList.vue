<script setup lang="ts">
import type { KeyResult } from '../../../content'
import { Icon } from '../../../shared/ui'

// Figma List/KeyResult: галочка декоративная (без label → aria-hidden), смысл — в тексте.
defineProps<{ items: KeyResult[] }>()
</script>

<template>
  <ul class="key-results">
    <li v-for="item in items" :key="item.result" class="key-results__item">
      <Icon class="key-results__check" name="check" />
      <div class="key-results__text">
        <span class="t-body-strong">{{ item.result }}</span>
        <span class="key-results__how t-body-small">{{ item.how }}</span>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.key-results {
  max-width: 64ch;
  margin: 0;
  padding: 0;
  list-style: none;
}

.key-results__item {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-2) 0;
}

.key-results__check {
  --icon-size: var(--space-5);

  color: var(--status-success);
}

.key-results__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.key-results__how {
  color: var(--text-secondary);
}
</style>
