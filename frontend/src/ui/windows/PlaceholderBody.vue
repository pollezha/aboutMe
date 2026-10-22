<script setup lang="ts">
import type { ContentBundle } from '../../content/types'

// Временное тело для глав 04–08: T3/T4 заменят записи реестра (index.ts) своими окнами.
defineProps<{ content: ContentBundle; now?: Date }>()
</script>

<template>
  <p class="t-body-default">Coming in the next task</p>
</template>
