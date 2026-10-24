<script setup lang="ts">
import { useId } from 'vue'

// Figma Chips: подпись + чипы; `mono` — стек и курсы (Mono/Stack), иначе Label/Caption (языки, «good fit»).
withDefaults(defineProps<{ label: string; items: string[]; mono?: boolean }>(), { mono: false })

const labelId = useId()
</script>

<template>
  <div class="chips">
    <p :id="labelId" class="chips__label t-label-eyebrow">{{ label }}</p>
    <ul class="chips__list" :aria-labelledby="labelId">
      <li
        v-for="item in items"
        :key="item"
        class="chips__chip"
        :class="mono ? 't-mono-stack' : 't-label-caption'"
      >
        {{ item }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.chips {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.chips__label {
  margin: 0;
  color: var(--text-secondary);
}

.chips__list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.chips__chip {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  background: var(--bg-surface-alt);
}
</style>
