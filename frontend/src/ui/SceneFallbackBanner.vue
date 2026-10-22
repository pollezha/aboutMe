<script setup lang="ts">
// Компактный баннер после таймаута/ошибки загрузки сцены (UX9): полоса с ×, не перекрывает Hero.
import IconButton from './IconButton.vue'

defineEmits<{ dismiss: [] }>()
</script>

<template>
  <div class="scene-banner" role="status">
    <p class="t-body-small scene-banner__text">3D scene didn't load — showing the map</p>
    <IconButton icon="close" label="Dismiss" @click="$emit('dismiss')" />
  </div>
</template>

<style scoped>
.scene-banner {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  box-sizing: border-box;
  padding: 0 var(--space-1) 0 var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  background: var(--bg-surface);
  box-shadow: var(--shadow-card);
}

.scene-banner__text {
  flex: 1;
  margin: 0;
}
</style>
