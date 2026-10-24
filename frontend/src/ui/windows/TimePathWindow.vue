<script setup lang="ts">
import { computed } from 'vue'
import { type ContentBundle, resolveChapter, resolveMetric } from '../../content'
import ChipList from './blocks/ChipList.vue'
import KeyResultList from './blocks/KeyResultList.vue'
import MetricGrid from './blocks/MetricGrid.vue'
import SectionHeading from './blocks/SectionHeading.vue'

// Figma Window/03 TimePath (figma-windows.md §03). Плейсхолдер reference letter не рендерится.
const props = withDefaults(defineProps<{ content: ContentBundle; now?: Date }>(), {
  now: () => new Date(),
})

const chapter = computed(() => resolveChapter(props.content, 'timepath', props.now))
const groups = computed(() =>
  chapter.value.metricGroups.map((group) => ({
    label: group.label,
    metrics: group.metrics.map((metric) => resolveMetric(metric, props.content, props.now)),
  })),
)
</script>

<template>
  <div class="chapter-body">
    <MetricGrid
      v-for="group in groups"
      :key="group.label"
      :label="group.label"
      :metrics="group.metrics"
      chapter="timepath"
    />
    <section class="chapter-body__section">
      <SectionHeading>{{ chapter.keyResults.heading }}</SectionHeading>
      <KeyResultList :items="chapter.keyResults.items" />
    </section>
    <ChipList v-bind="chapter.stack" mono />
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
