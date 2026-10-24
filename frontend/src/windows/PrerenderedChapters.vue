<script setup lang="ts">
import { computed } from 'vue'
import { BUILD_TIME, CHAPTERS, contentFor, resolveChapter } from '../content'
import { WINDOWS } from '../chapters'
import { useLangStore } from '../locale'
import ProofLinks from './ProofLinks.vue'

// Предрендер (vite-ssg): окна закрыты, но текст всех глав должен быть в HTML (FR11). Клиент монтирует
// приложение заново (без гидрации), поэтому блок есть только в статическом HTML и не дублирует окна.
const prerender = import.meta.env.SSR || typeof window === 'undefined'

const langStore = useLangStore()
const content = computed(() => contentFor(langStore.lang))
const now = BUILD_TIME
const chapters = computed(() =>
  prerender ? CHAPTERS.map(({ id }) => ({ id, ...resolveChapter(content.value, id, now) })) : [],
)
</script>

<template>
  <section v-if="prerender" id="chapters" hidden>
    <article v-for="chapter in chapters" :id="`chapter-${chapter.id}`" :key="chapter.id">
      <p>{{ chapter.eyebrow }}</p>
      <h2>{{ chapter.title }}</h2>
      <p v-if="chapter.subtitle">{{ chapter.subtitle }}</p>
      <component :is="WINDOWS[chapter.id].body" :content="content" :now="now" />
      <ProofLinks :links="chapter.proofLinks" />
    </article>
  </section>
</template>
