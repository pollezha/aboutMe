<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { type ContentBundle, resolveChapter, type WindowMetric } from '../../content'
import { Icon } from '../../shared/ui'
import MetaRow from './blocks/MetaRow.vue'
import MetricGrid from './blocks/MetricGrid.vue'
import SectionHeading from './blocks/SectionHeading.vue'

// Figma Window/08 Monitoring (figma-windows.md §08), этап 3: только offline-состояние, без сети.
// Живые значения (SignalR, live-hub) — этап 4; до тех пор карточки показывают «—».
const props = withDefaults(defineProps<{ content: ContentBundle; now?: Date }>(), {
  now: () => new Date(),
})

const { t } = useI18n()
const chapter = computed(() => resolveChapter(props.content, 'monitoring', props.now))
const NO_VALUE = '—'
const metrics = computed<WindowMetric[]>(() =>
  chapter.value.metrics.map((metric) => ({ ...metric, value: NO_VALUE, accent: false })),
)
</script>

<template>
  <div class="chapter-body">
    <p class="status-line t-label-caption" role="status" aria-live="polite">
      <span class="status-line__led" aria-hidden="true"></span>{{ t('window.monitoring.offline') }}
    </p>
    <MetricGrid :metrics="metrics" chapter="monitoring" size="sm" />
    <section class="chapter-body__section">
      <SectionHeading>{{ chapter.clickPath.heading }}</SectionHeading>
      <ol class="flow">
        <li v-for="(step, i) in chapter.clickPath.steps" :key="step" class="flow__item">
          <span
            class="flow__step t-mono-stack"
            :class="{
              'flow__step--edge': i === 0 || i === chapter.clickPath.steps.length - 1,
            }"
            >{{ step }}</span
          >
          <Icon
            v-if="i < chapter.clickPath.steps.length - 1"
            class="flow__arrow"
            name="arrow-right"
          />
        </li>
      </ol>
    </section>
    <section class="chapter-body__section">
      <SectionHeading>{{ chapter.observability.heading }}</SectionHeading>
      <div class="observability">
        <MetaRow
          v-for="item in chapter.observability.items"
          :key="item.label"
          v-bind="item"
          class="observability__item"
        />
      </div>
    </section>
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
  gap: var(--space-3);
}

.status-line {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  color: var(--text-secondary);
}

.status-line__led {
  flex: none;
  width: var(--space-2);
  height: var(--space-2);
  border-radius: var(--radius-full);
  background: var(--text-secondary);
}

.flow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.flow__item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.flow__step {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  background: var(--bg-surface-alt);
}

.flow__step--edge {
  color: var(--bg-surface);
  background: var(--text-primary);
}

.flow__arrow {
  --icon-size: 18px;

  color: var(--text-secondary);
}

.observability {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.observability__item {
  flex: 1 1 280px;
}
</style>
