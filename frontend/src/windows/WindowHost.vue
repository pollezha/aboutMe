<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import ChapterWindow from './ChapterWindow.vue'
import ProofLinks from './ProofLinks.vue'
import { useChapterWindow } from './useChapterWindow'
import { useWindowHistory } from './useWindowHistory'

// Окно открытой главы: шапка/подвал — useChapterWindow, тело — из реестра chapters, URL-хэш и история —
// useWindowHistory (deep link при монтировании). Фокус и возврат фокуса — в ChapterWindow/Dialog.
const { t } = useI18n()
const { view, content, now, goPrev, goNext } = useChapterWindow()
const { onWindowOpen } = useWindowHistory()
</script>

<template>
  <ChapterWindow
    v-if="view"
    :open="true"
    :chapter="view.id"
    :number="view.number"
    :eyebrow="view.eyebrow"
    :sign="view.sign"
    :title="view.title"
    :subtitle="view.subtitle"
    :prev="view.prev"
    :next="view.next"
    :close-label="t('window.close')"
    :links-label="t('window.links')"
    :next-label="t('window.next')"
    @update:open="onWindowOpen"
    @prev="goPrev"
    @next="goNext"
  >
    <component :is="view.body" :content="content" :now="now" />
    <template #links><ProofLinks :links="view.proofLinks" /></template>
  </ChapterWindow>
</template>
