<script setup lang="ts">
import { computed } from 'vue'
import { type ContentBundle, resolveChapter, resolveMetric } from '../../content'
import ChipList from './blocks/ChipList.vue'
import WindowColumns from './blocks/WindowColumns.vue'
import KeyResultList from './blocks/KeyResultList.vue'
import MetaRow from './blocks/MetaRow.vue'
import MetricGrid from './blocks/MetricGrid.vue'
import SectionHeading from './blocks/SectionHeading.vue'

// Figma Window/02 ProSpace (figma-windows.md §02). Плейсхолдер скриншотов (NDA) не рендерится.
const props = withDefaults(defineProps<{ content: ContentBundle; now?: Date }>(), {
  now: () => new Date(),
})

const chapter = computed(() => resolveChapter(props.content, 'prospace', props.now))
const metrics = computed(() =>
  chapter.value.metrics.map((metric) => resolveMetric(metric, props.content, props.now)),
)
</script>

<template>
  <div class="chapter-body">
    <MetricGrid :metrics="metrics" chapter="prospace" />
    <section class="chapter-body__section">
      <SectionHeading>{{ chapter.keyResults.heading }}</SectionHeading>
      <KeyResultList :items="chapter.keyResults.items" />
    </section>
    <WindowColumns>
      <ChipList v-bind="chapter.stack" mono />
      <MetaRow v-bind="chapter.team" />
    </WindowColumns>
  </div>
</template>

<style scoped>
.chapter-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.chapter-body__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
</style>
