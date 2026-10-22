<script lang="ts">
export interface HeroProfile {
  name: string
  /** Должность без стажа: стаж показывается один раз — третьей метрикой (R1). */
  role: string
  status: string
  workFormat: string
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
import BaseButton from './BaseButton.vue'
import Icon from './Icon.vue'
import MetricCard from './MetricCard.vue'
import StatusPill from './StatusPill.vue'

withDefaults(
  defineProps<{
    variant?: 'desktop' | 'laptop' | 'mobile'
    profile: HeroProfile
    /** Три готовые метрики; стаж уже посчитан контейнером из `experience[]`. */
    highlights: HeroMetric[]
    links: HeroLinks
    contactLabel?: string
    cvLabel?: string
    telegramLabel?: string
    monitoringLabel?: string
  }>(),
  {
    variant: 'desktop',
    contactLabel: 'Contact',
    cvLabel: 'CV (PDF)',
    telegramLabel: 'Telegram',
    monitoringLabel: 'Monitoring · this site, live →',
  },
)

const emit = defineEmits<{ contact: []; monitoring: [] }>()
</script>

<template>
  <section class="hero" :class="`hero--${variant}`">
    <StatusPill>{{ profile.status }}</StatusPill>
    <h1 class="hero__name t-display-hero">{{ profile.name }}</h1>
    <p class="hero__role t-heading-section">{{ profile.role }}</p>
    <p class="hero__where t-body-small">{{ profile.workFormat }} · {{ profile.location }}</p>

    <div class="hero__actions">
      <BaseButton variant="primary" @click="emit('contact')">{{ contactLabel }}</BaseButton>
      <BaseButton v-if="links.cv" as="a" variant="secondary" :href="links.cv">
        {{ cvLabel }}
        <template #icon><Icon name="download" /></template>
      </BaseButton>
      <template v-if="links.telegram">
        <a
          v-if="variant === 'mobile'"
          class="hero__icon-link"
          :href="links.telegram"
          :aria-label="telegramLabel"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="telegram" />
        </a>
        <BaseButton
          v-else
          as="a"
          variant="ghost"
          :href="links.telegram"
          target="_blank"
          rel="noreferrer"
        >
          {{ telegramLabel }}
          <template #icon><Icon name="external" /></template>
        </BaseButton>
      </template>
    </div>

    <div class="hero__metrics">
      <MetricCard
        v-for="metric in highlights"
        :key="metric.label"
        size="sm"
        :label="metric.label"
        :value="metric.value"
        :note="metric.note"
      />
    </div>

    <BaseButton
      v-if="variant === 'mobile'"
      variant="ghost"
      class="hero__monitoring"
      @click="emit('monitoring')"
    >
      {{ monitoringLabel }}
    </BaseButton>
  </section>
</template>

<style scoped>
.hero {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-4);
  box-sizing: border-box;
  width: 520px;
  max-width: 100%;
  padding: var(--space-6);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  background: var(--bg-surface);
  box-shadow: var(--shadow-card);
}

.hero--laptop {
  width: 440px;
  gap: var(--space-2);
  padding: var(--space-4);
}

.hero--mobile {
  width: 358px;
  gap: var(--space-3);
  padding: var(--space-4);
}

.hero__name,
.hero__role,
.hero__where {
  margin: 0;
}

.hero--laptop .hero__name {
  font-size: var(--font-size-xl);
  line-height: 1.15;
  letter-spacing: -0.005em;
}

.hero--mobile .hero__name {
  font-size: 32px;
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

/* Иконка-ссылка Telegram на mobile: те же размеры и цвета, что у IconButton. */
.hero__icon-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: var(--size-touch);
  height: var(--size-touch);
  border-radius: var(--radius-full);
  color: var(--bg-surface);
  background: var(--text-primary);

  --icon-size: var(--space-5);
}

.hero__icon-link:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: 2px;
}

.hero__metrics {
  display: flex;
  gap: var(--space-2);
  align-self: stretch;
}

.hero__metrics > * {
  flex: 1 0 0;
}

.hero--laptop .hero__metrics > *,
.hero--mobile .hero__metrics > * {
  min-width: 0;
}

.hero--mobile .hero__metrics {
  flex-wrap: wrap;
}
</style>
