<script setup lang="ts">
// Подписи над шестью зданиями (ADR-0003: HTML поверх 3D). Html проецирует мировую точку на экран
// каждый кадр, поэтому при повороте камеры подпись остаётся над своим зданием.
// tabindex=-1: Tab идёт по бару (Specs §3), подписи — дополнительный вход для мыши.
import { Html } from '@tresjs/cientos'
import { computed } from 'vue'
import { ROUTE } from '../content'
import { chapterLabel } from '../i18n'
import { useUiStore } from '../stores/ui'
import { stops } from './layout'

defineOptions({ name: 'SceneLabels' })

const ui = useUiStore()

const labels = computed(() =>
  stops.map((stop) => {
    const chapter = ROUTE.find((item) => item.id === stop.id)
    if (!chapter) throw new Error(`scene: stop ${stop.id} is not on the route`)
    const { title } = chapterLabel(chapter.id, ui.lang)
    return { id: chapter.id, position: stop.label, title, name: `${chapter.index} ${title}` }
  }),
)
</script>

<template>
  <Html v-for="label in labels" :key="label.id" :position="label.position" center :occlude="false">
    <button
      type="button"
      tabindex="-1"
      class="scene-label t-label-caption"
      :aria-label="label.name"
      @click="ui.openChapter(label.id)"
    >
      {{ label.title }}
    </button>
  </Html>
</template>

<style scoped>
.scene-label {
  padding: var(--space-1) var(--space-2);
  color: var(--text-primary);
  white-space: nowrap;
  cursor: pointer;
  background: var(--bg-surface);
  border: 0;
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-card);
}
</style>
