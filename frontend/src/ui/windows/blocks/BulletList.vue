<script setup lang="ts">
import { useId } from 'vue'

// Подпись Label/Eyebrow + пункты Body/Default (Education: TEAM PROJECTS, STUDY + WORK).
defineProps<{ label: string; items: string[] }>()

const labelId = useId()
</script>

<template>
  <div class="bullets">
    <p :id="labelId" class="bullets__label t-label-eyebrow">{{ label }}</p>
    <ul class="bullets__list t-body-default" :aria-labelledby="labelId">
      <li v-for="item in items" :key="item">{{ item }}</li>
    </ul>
  </div>
</template>

<style scoped>
.bullets {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-width: 64ch;
}

.bullets__label {
  margin: 0;
  color: var(--text-secondary);
}

.bullets__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin: 0;
  padding-left: var(--space-5);
  color: var(--text-primary);
}
</style>
