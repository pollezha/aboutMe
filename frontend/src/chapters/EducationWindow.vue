<script setup lang="ts">
import { computed } from 'vue'
import { type ContentBundle, resolveChapter } from '../content'
import BulletList from './blocks/BulletList.vue'
import ChipList from './blocks/ChipList.vue'
import MetaRow from './blocks/MetaRow.vue'
import WindowColumns from './blocks/WindowColumns.vue'

// Figma Window/05 Education (figma-windows.md §05). Плейсхолдер «Diploma PDF» не рендерится.
const props = withDefaults(defineProps<{ content: ContentBundle; now?: Date }>(), {
  now: () => new Date(),
})

const chapter = computed(() => resolveChapter(props.content, 'education', props.now))
</script>

<template>
  <div class="chapter-body">
    <WindowColumns>
      <div class="chapter-body__column">
        <MetaRow v-bind="chapter.programme" />
        <MetaRow v-bind="chapter.format" />
        <MetaRow v-bind="chapter.graduated" />
        <MetaRow v-bind="chapter.thesis" />
        <BulletList v-bind="chapter.teamProjects" />
      </div>
      <div class="chapter-body__column">
        <ChipList v-bind="chapter.courses" mono />
        <BulletList v-bind="chapter.studyWork" />
        <ChipList v-bind="chapter.languages" mono />
      </div>
    </WindowColumns>
  </div>
</template>

<style scoped>
.chapter-body__column {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  min-width: 0;
}
</style>
