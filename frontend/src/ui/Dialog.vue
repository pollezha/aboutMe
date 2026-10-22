<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

defineOptions({ name: 'UiDialog' })

const props = withDefaults(
  defineProps<{
    open: boolean
    /** id заголовка внутри окна → aria-labelledby. */
    labelledBy: string
    /** id описания (необязательно) → aria-describedby. */
    describedBy?: string
  }>(),
  { describedBy: undefined },
)

const emit = defineEmits<{ 'update:open': [value: boolean]; close: [] }>()

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const dialog = ref<HTMLDialogElement | null>(null)
let opener: HTMLElement | null = null

function show() {
  const el = dialog.value
  if (!el || el.open) return
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
  el.showModal()
  const first = el.querySelector<HTMLElement>(FOCUSABLE)
  ;(first ?? el).focus()
}

function hide() {
  const el = dialog.value
  if (el?.open) el.close()
  const target = opener
  opener = null
  if (target?.isConnected) target.focus()
}

function requestClose() {
  emit('update:open', false)
  emit('close')
}

// Esc: состояние держит родитель (v-model:open), поэтому нативное закрытие отменяем.
function onCancel(event: Event) {
  event.preventDefault()
  requestClose()
}

// Сам <dialog> без отступов: клик с target === dialog — это клик по ::backdrop.
function onClick(event: MouseEvent) {
  if (event.target === dialog.value) requestClose()
}

watch(
  () => props.open,
  (open) => (open ? show() : hide()),
)

onMounted(() => {
  if (props.open) show()
})

onBeforeUnmount(() => {
  if (dialog.value?.open) hide()
})
</script>

<template>
  <dialog
    ref="dialog"
    class="dialog"
    tabindex="-1"
    aria-modal="true"
    :aria-labelledby="labelledBy"
    :aria-describedby="describedBy"
    @cancel="onCancel"
    @click="onClick"
  >
    <slot />
  </dialog>
</template>

<style scoped>
.dialog {
  padding: 0;
  border: 0;
  color: inherit;
  background: transparent;
  overflow: visible;
}

.dialog:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: 2px;
}

.dialog[open] {
  animation: dialog-in 0.18s ease-out;
}

.dialog::backdrop {
  background: color-mix(in srgb, var(--chapter-techstack) 55%, transparent);
}

.dialog[open]::backdrop {
  animation: backdrop-in 0.18s ease-out;
}

@keyframes dialog-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
}

@keyframes backdrop-in {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dialog[open],
  .dialog[open]::backdrop {
    animation: none;
  }
}
</style>
