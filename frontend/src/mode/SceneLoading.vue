<script setup lang="ts">
// Figma `Screen/State/Loading scene` 34:964, LoadingCard 34:1119: карточка справа внизу над баром, не над Hero;
// неопределённый индикатор без ложной шкалы и явный выход в 2D (FR10, UX9).
import { useI18n } from 'vue-i18n'
import { BaseButton } from '../shared/ui'

defineEmits<{ skip: [] }>()

const { t } = useI18n()
</script>

<template>
  <section class="scene-loading" role="status" :aria-label="t('scene.loading')">
    <span class="scene-loading__spinner" aria-hidden="true" />
    <div class="scene-loading__text">
      <p class="t-body-strong">{{ t('scene.loading') }}</p>
      <p class="t-body-small scene-loading__hint">{{ t('scene.hint') }}</p>
    </div>
    <BaseButton variant="secondary" @click="$emit('skip')">{{ t('scene.skip') }}</BaseButton>
  </section>
</template>

<style scoped>
.scene-loading {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  box-sizing: border-box;
  padding: var(--space-4) var(--space-5);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  background: var(--bg-surface);
  box-shadow: var(--shadow-card);
}

.scene-loading__text p {
  margin: 0;
}

.scene-loading__hint {
  color: var(--text-secondary);
}

.scene-loading__spinner {
  flex: none;
  width: var(--space-6);
  height: var(--space-6);
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: var(--radius-full);
  animation: scene-loading-spin 0.9s linear infinite;
}

@keyframes scene-loading-spin {
  to {
    transform: rotate(1turn);
  }
}

@media (prefers-reduced-motion: reduce) {
  .scene-loading__spinner {
    animation-duration: 3s;
  }
}
</style>
