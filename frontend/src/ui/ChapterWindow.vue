<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import BaseButton from './BaseButton.vue'
import Dialog from './Dialog.vue'
import Icon from './Icon.vue'
import IconButton from './IconButton.vue'
import type { IconName } from './icon-registry'
import type { Chapter } from './ChapterTag.vue'

interface ChapterLink {
  number: string
  title: string
}

const props = withDefaults(
  defineProps<{
    chapter: Chapter
    number: string
    eyebrow: string
    /** Знак главы в строке eyebrow (Figma Icon/sign-*, 20 px); без него — точка цвета главы. */
    sign?: IconName
    title: string
    subtitle?: string
    prev?: ChapterLink
    next?: ChapterLink
    open: boolean
    /** Строки интерфейса из i18n (контейнер). */
    closeLabel: string
    linksLabel: string
    nextLabel: string
  }>(),
  {
    subtitle: undefined,
    sign: undefined,
    prev: undefined,
    next: undefined,
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  close: []
  prev: []
  next: []
}>()

const titleId = useId()
const titleEl = ref<HTMLElement | null>(null)
const bodyEl = ref<HTMLElement | null>(null)

// prev/next меняют главу в том же окне: фокус и прокрутка — как у только что открытого окна.
watch(
  () => props.chapter,
  async () => {
    await nextTick()
    if (bodyEl.value) bodyEl.value.scrollTop = 0
    titleEl.value?.focus()
  },
)
const style = computed(() => `--chapter: var(--chapter-${props.chapter})`)

function requestClose() {
  emit('update:open', false)
  emit('close')
}
</script>

<template>
  <Dialog
    class="chapter-window"
    :open="open"
    :labelled-by="titleId"
    :data-chapter="chapter"
    :style="style"
    @update:open="emit('update:open', $event)"
    @close="emit('close')"
  >
    <article class="window">
      <header class="window__header">
        <div class="window__heading">
          <p class="window__eyebrow t-label-eyebrow" :class="{ 'window__eyebrow--sign': sign }">
            <Icon v-if="sign" class="window__sign" :name="sign" />{{ eyebrow }}
          </p>
          <h2 :id="titleId" ref="titleEl" tabindex="-1" class="window__title t-heading-window">
            {{ title }}
          </h2>
          <p v-if="subtitle" class="window__subtitle t-body-default">{{ subtitle }}</p>
        </div>
        <IconButton icon="close" :label="closeLabel" @click="requestClose" />
      </header>

      <!-- Тело прокручивается: tabindex — чтобы его можно было листать с клавиатуры (axe scrollable-region-focusable). -->
      <div ref="bodyEl" class="window__body" role="region" :aria-labelledby="titleId" tabindex="0">
        <slot />
      </div>

      <footer class="window__footer">
        <div class="window__links">
          <span class="t-label-eyebrow">{{ linksLabel }}</span>
          <slot name="links" />
        </div>
        <nav v-if="prev || next" class="window__nav">
          <BaseButton v-if="prev" variant="ghost" @click="emit('prev')">
            ← {{ prev.number }} {{ prev.title }}
          </BaseButton>
          <BaseButton v-if="next" variant="secondary" @click="emit('next')">
            {{ nextLabel }}: {{ next.number }} {{ next.title }}
            <template #icon><Icon name="arrow-right" /></template>
          </BaseButton>
        </nav>
      </footer>
    </article>
  </Dialog>
</template>

<style scoped>
.chapter-window {
  width: min(calc(100% - var(--space-8) * 2), var(--size-window-max));
  max-width: var(--size-window-max);
  /* Figma Window/Shell desktop: 1120 × 640 максимум. */
  height: min(calc(100dvh - var(--space-8) * 2), 640px);
  max-height: none;
}

.window {
  --window-pad: var(--space-8);

  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  border-top: 6px solid var(--chapter);
  color: var(--text-primary);
  background: var(--bg-surface);
}

.window__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--window-pad) var(--window-pad) var(--space-4);
}

.window__heading {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.window__eyebrow {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  color: var(--text-secondary);
}

.window__eyebrow:not(.window__eyebrow--sign)::before {
  content: '';
  flex: none;
  width: var(--space-2);
  height: var(--space-2);
  border-radius: var(--radius-full);
  background: var(--chapter);
}

.window__sign {
  --icon-size: var(--space-5);
}

.window__title,
.window__subtitle {
  margin: 0;
}

.window__subtitle {
  color: var(--text-secondary);
}

.window__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 var(--window-pad) var(--space-4);
}

.window__body:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: -3px;
}

.window__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4) var(--window-pad);
  border-top: 1px solid var(--border);
  background: var(--bg-surface-alt);
}

.window__links,
.window__nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

@media (width < 768px) {
  .chapter-window {
    width: 100%;
    max-width: none;
    height: 100dvh;
    margin: 0;
  }

  .window {
    --window-pad: var(--space-4);
  }
}

/* Скругление и тень — только у плавающего окна; на mobile окно на весь экран. */
@media (width >= 768px) {
  .window {
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-panel);
  }
}

@media (prefers-reduced-motion: reduce) {
  .window__body {
    scroll-behavior: auto;
  }
}
</style>
