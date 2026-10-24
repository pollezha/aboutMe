<script setup lang="ts">
import { computed } from 'vue'
import { type ContentBundle, resolveChapter, resolveHighlights } from '../../content'
import ChipList from './blocks/ChipList.vue'
import MetaRow from './blocks/MetaRow.vue'
import MetricGrid from './blocks/MetricGrid.vue'

// Figma Window/01 Profile (figma-windows.md §01). Фото не показываем (решение по плану этапа 3) → одна колонка ColB.
const props = withDefaults(defineProps<{ content: ContentBundle; now?: Date }>(), {
  now: () => new Date(),
})

const chapter = computed(() => resolveChapter(props.content, 'profile', props.now))
// Те же метрики, что в Hero.
const keyNumbers = computed(() =>
  resolveHighlights(props.content, props.now).map((metric) => ({ ...metric, accent: false })),
)
</script>

<template>
  <div class="chapter-body">
    <MetaRow v-bind="chapter.name" />
    <MetaRow v-bind="chapter.since" />
    <MetricGrid
      :label="chapter.keyNumbers.label"
      :metrics="keyNumbers"
      chapter="profile"
      size="sm"
    />
    <MetaRow v-bind="chapter.about" />
    <ChipList v-bind="chapter.languages" />
    <MetaRow v-bind="chapter.lookingFor" />
  </div>
</template>

<style scoped>
.chapter-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
</style>
