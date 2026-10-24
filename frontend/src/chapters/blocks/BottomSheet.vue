<script setup lang="ts">
import { onMounted, ref } from 'vue'

// Figma BottomSheet (телефон): snap 60 % высоты, handle, scrim. Живёт внутри <dialog> окна главы,
// поэтому это не второй <dialog>: фокус-ловушку и Esc держит сам sheet. Возврат фокуса — у родителя.
defineProps<{ labelledBy: string }>()

const emit = defineEmits<{ close: [] }>()

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Свайп вниз длиннее этого — закрыть. */
const SWIPE_CLOSE_PX = 64

const sheet = ref<HTMLElement | null>(null)
const dragY = ref(0)
let dragStart: number | null = null

function focusables(): HTMLElement[] {
  return [...(sheet.value?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
}

onMounted(() => {
  ;(focusables()[0] ?? sheet.value)?.focus()
})

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    // Не даём Esc дойти до <dialog> окна: закрывается только sheet.
    event.preventDefault()
    event.stopPropagation()
    emit('close')
    return
  }
  if (event.key !== 'Tab') return
  const items = focusables()
  const first = items[0]
  const last = items[items.length - 1]
  if (!first || !last) {
    event.preventDefault()
    return
  }
  const current = document.activeElement
  if (event.shiftKey && (current === first || !sheet.value?.contains(current))) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && current === last) {
    event.preventDefault()
    first.focus()
  }
}

function onPointerDown(event: PointerEvent) {
  dragStart = event.clientY
}

function onPointerMove(event: PointerEvent) {
  if (dragStart !== null) dragY.value = Math.max(0, event.clientY - dragStart)
}

function onPointerUp() {
  const swiped = dragY.value > SWIPE_CLOSE_PX
  dragStart = null
  dragY.value = 0
  if (swiped) emit('close')
}
</script>

<template>
  <div class="bottom-sheet">
    <div class="bottom-sheet__scrim" @click="emit('close')"></div>
    <div
      ref="sheet"
      class="bottom-sheet__panel"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="labelledBy"
      tabindex="-1"
      :style="dragY ? { transform: `translateY(${dragY}px)` } : undefined"
      @keydown="onKeydown"
    >
      <div
        class="bottom-sheet__grip"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <span class="bottom-sheet__handle" aria-hidden="true"></span>
      </div>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.bottom-sheet__scrim {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--chapter-techstack) 55%, transparent);
}

.bottom-sheet__panel {
  position: fixed;
  inset: auto 0 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  height: 60dvh;
  padding: var(--space-2) var(--space-4) var(--space-6);
  overflow-y: auto;
  border-start-start-radius: var(--radius-lg);
  border-start-end-radius: var(--radius-lg);
  color: var(--text-primary);
  background: var(--bg-surface);
  box-shadow: var(--shadow-panel);
  animation: sheet-in 0.2s ease-out;
}

.bottom-sheet__panel:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: -3px;
}

.bottom-sheet__grip {
  display: flex;
  justify-content: center;
  padding: var(--space-2) 0;
  touch-action: none;
  cursor: grab;
}

.bottom-sheet__handle {
  width: 36px;
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--border);
}

@keyframes sheet-in {
  from {
    transform: translateY(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .bottom-sheet__panel {
    animation: none;
  }
}
</style>
