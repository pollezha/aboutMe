<script setup lang="ts">
import type { ProofLink } from '../content'
import { useRouteStore } from '../route'
import { BaseButton, Icon } from '../shared/ui'

// Футер окна «Proof & links»: внешние ссылки — в новой вкладке, файлы — download, ссылка на главу — окно.
defineProps<{ links: ProofLink[] }>()

const route = useRouteStore()
</script>

<template>
  <template v-for="link in links" :key="link.label">
    <BaseButton
      v-if="'chapter' in link"
      variant="ghost"
      class="proof-link"
      @click="route.openChapter(link.chapter)"
    >
      {{ link.label }}
      <template #icon><Icon name="arrow-right" /></template>
    </BaseButton>
    <BaseButton
      v-else
      as="a"
      variant="ghost"
      class="proof-link"
      :href="link.href"
      :target="link.icon === 'external' ? '_blank' : undefined"
      :download="link.icon === 'download' ? '' : undefined"
    >
      {{ link.label }}
      <template #icon><Icon :name="link.icon" /></template>
    </BaseButton>
  </template>
</template>
