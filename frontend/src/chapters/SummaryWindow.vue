<script setup lang="ts">
import { computed } from 'vue'
import { type ContentBundle, resolveChapter, resolveMetric } from '../content'
import { useRouteStore } from '../route'
import { BaseButton, Icon } from '../shared/ui'
import KeyResultList from './blocks/KeyResultList.vue'
import MetricGrid from './blocks/MetricGrid.vue'
import SectionHeading from './blocks/SectionHeading.vue'

// Figma Window/07 30-sec summary (figma-windows.md §07). Вне маршрута: без prev/next (routeNeighbours).
const props = withDefaults(defineProps<{ content: ContentBundle; now?: Date }>(), {
  now: () => new Date(),
})

const route = useRouteStore()
const chapter = computed(() => resolveChapter(props.content, 'summary', props.now))
const metrics = computed(() =>
  chapter.value.metrics.map((metric) => resolveMetric(metric, props.content, props.now)),
)
</script>

<template>
  <div class="chapter-body">
    <MetricGrid :metrics="metrics" chapter="summary" />
    <section class="chapter-body__section">
      <SectionHeading>{{ chapter.whatIDo.heading }}</SectionHeading>
      <KeyResultList :items="chapter.whatIDo.items" />
    </section>
    <div class="cta">
      <BaseButton variant="primary" @click="route.openChapter(chapter.cta.contact.chapter)">
        {{ chapter.cta.contact.label }}
      </BaseButton>
      <BaseButton as="a" variant="secondary" :href="chapter.cta.cv.href" download="">
        {{ chapter.cta.cv.label }}
        <template #icon><Icon name="download" /></template>
      </BaseButton>
    </div>
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

.cta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
