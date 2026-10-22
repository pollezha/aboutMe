<script setup lang="ts">
import IconButton from '../../IconButton.vue'
import MetaRow from './MetaRow.vue'
import SectionHeading from './SectionHeading.vue'

// Figma ServerPanel (desktop) / шапка и тело BottomSheet (телефон): имя, срок, где и что.
withDefaults(
  defineProps<{
    name: string
    /** id заголовка → aria-labelledby у sheet. */
    nameId: string
    term: string
    /** Срок и начало: `serverTenure().label`. */
    tenure: string
    where: string
    what: string
    experienceLabel: string
    whereLabel: string
    whatLabel: string
    /** sheet: в шапке срок и кнопка закрытия. */
    variant?: 'panel' | 'sheet'
    closeLabel?: string
  }>(),
  { variant: 'panel', closeLabel: 'Close' },
)

const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div class="server-details" :class="`server-details--${variant}`">
    <div class="server-details__header">
      <SectionHeading :id="nameId" class="server-details__name">{{ name }}</SectionHeading>
      <template v-if="variant === 'sheet'">
        <span class="server-details__term t-mono-stack">{{ term }}</span>
        <IconButton icon="close" :label="closeLabel" @click="emit('close')" />
      </template>
    </div>
    <MetaRow :label="experienceLabel" :value="tenure" />
    <MetaRow :label="whereLabel" :value="where" />
    <MetaRow :label="whatLabel" :value="what" />
  </div>
</template>

<style scoped>
.server-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.server-details--sheet {
  gap: var(--space-3);
}

.server-details__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.server-details__name {
  flex: 1;
  min-width: 0;
}

.server-details__term {
  color: var(--text-secondary);
}
</style>
