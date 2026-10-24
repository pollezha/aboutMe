<script lang="ts">
export interface HeroProfile {
  name: string
  /** Должность без стажа: стаж показывается один раз — третьей метрикой (R1). */
  role: string
  status: string
  workFormat: string
  /** Короткая локация для строки-меты: «Serbia · CET». */
  location: string
}

export interface HeroMetric {
  label: string
  value: string
  note: string
}

export interface HeroLinks {
  cv?: string
  telegram?: string
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { BaseButton, Icon, IconButton, StatusPill } from '../shared/ui'

// Hero не закрывает сцену (figma-brief): на desktop/laptop — компактная карточка 400/360 с метриками
// в одну строку; на телефоне — без метрик, чтобы карта целиком вошла в первый экран.
const props = withDefaults(
  defineProps<{
    variant?: 'desktop' | 'laptop' | 'mobile'
    profile: HeroProfile
    /** Три готовые метрики; стаж уже посчитан контейнером из `experience[]`. */
    highlights: HeroMetric[]
    links: HeroLinks
    /** Подписи: «Contact» — i18n, CV и Telegram — подписи ссылок из контента (контейнер). */
    contactLabel: string
    cvLabel: string
    telegramLabel: string
  }>(),
  { variant: 'desktop' },
)

const emit = defineEmits<{ contact: [] }>()

const compact = computed(() => props.variant !== 'mobile')
</script>

<template>
  <section class="hero" :class="[`hero--${variant}`, { 'hero--compact': compact }]">
    <StatusPill>{{ profile.status }}</StatusPill>
    <div class="hero__identity">
      <h1 class="hero__name t-display-hero-sm">{{ profile.name }}</h1>
      <p class="hero__role" :class="compact ? 't-heading-section' : 't-label-caption'">
        {{ profile.role }}
      </p>
      <p class="hero__where t-body-small">{{ profile.workFormat }} · {{ profile.location }}</p>
    </div>

    <div class="hero__actions">
      <BaseButton variant="primary" @click="emit('contact')">{{ contactLabel }}</BaseButton>
      <BaseButton v-if="links.cv" as="a" variant="secondary" :href="links.cv">
        {{ cvLabel }}
        <template #icon><Icon name="download" /></template>
      </BaseButton>
      <IconButton
        v-if="links.telegram"
        as="a"
        icon="telegram"
        :label="telegramLabel"
        :href="links.telegram"
        target="_blank"
        rel="noreferrer"
      />
    </div>

    <ul v-if="compact" class="hero__metrics">
      <li v-for="metric in highlights" :key="metric.label" class="hero__metric">
        <span class="hero__metric-value t-display-number-sm">{{ metric.value }}</span>
        <span class="hero__metric-label t-label-tag-xs">{{ metric.label }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.hero {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
  box-sizing: border-box;
  max-width: 100%;
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  background: var(--bg-surface);
  box-shadow: var(--shadow-card);
}

.hero--desktop {
  width: 400px;
}

.hero--laptop {
  width: 360px;
}

.hero--mobile {
  width: 358px;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
}

.hero__identity {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

/* Телефон: Hero ≤ 190 px, чтобы карта-квадрат целиком помещалась над фикс-баром. */
.hero--mobile .hero__identity {
  gap: 0;
}

.hero__name,
.hero__role,
.hero__where {
  margin: 0;
}

.hero__where {
  color: var(--text-secondary);
}

.hero__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

/* Узкий Hero (телефон 358, laptop 360): «Связаться» + «Резюме (PDF)» + Telegram — в одну строку с полями 16 px. */
.hero--mobile .hero__actions :deep(.btn),
.hero--laptop .hero__actions :deep(.btn) {
  padding-inline: var(--space-4);
}

.hero__metrics {
  display: flex;
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
}

.hero--laptop .hero__metrics {
  gap: var(--space-3);
}

.hero__metric {
  display: flex;
  flex-direction: column;
}

.hero__metric-value {
  white-space: nowrap;
}

.hero__metric-label {
  color: var(--text-secondary);
}
</style>
