<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import RackServer from './RackServer.vue'

defineOptions({ name: 'ServerRack' })

// Figma Rack: заголовок Label/Eyebrow + серверы. Клавиатура — roving tabindex внутри стойки:
// стрелки двигают фокус (по кругу), Home/End — к краям, Enter/Space выбирают.
export interface RackServerItem {
  name: string
  term: string
}

const props = withDefaults(
  defineProps<{
    name: string
    servers: RackServerItem[]
    /** Индекс выбранного сервера в этой стойке, −1 — выбран сервер другой стойки. */
    selected: number
    /** Телефон: выбор раскрывает sheet → у кнопок aria-expanded. */
    expandable?: boolean
    /** Sheet открыт (для выбранного сервера). */
    open?: boolean
  }>(),
  { expandable: false, open: false },
)

const emit = defineEmits<{ select: [index: number] }>()

const list = ref<HTMLElement | null>(null)
const active = ref(Math.max(props.selected, 0))

watch(
  () => props.selected,
  (index) => {
    if (index >= 0) active.value = index
  },
)

const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

async function moveTo(index: number) {
  active.value = index
  await nextTick()
  list.value?.querySelectorAll<HTMLElement>('.rack-server')[index]?.focus()
}

function onKeydown(event: KeyboardEvent, index: number) {
  const count = props.servers.length
  const step = STEP[event.key]
  if (step !== undefined) {
    event.preventDefault()
    void moveTo((index + step + count) % count)
  } else if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault()
    void moveTo(event.key === 'Home' ? 0 : count - 1)
  } else if (event.key === 'Enter' || event.key === ' ') {
    // Выбор идемпотентен: если браузер всё же пришлёт click, повтор ничего не меняет.
    event.preventDefault()
    select(index)
  }
}

function select(index: number) {
  active.value = index
  emit('select', index)
}
</script>

<template>
  <div class="rack" role="group" :aria-label="name">
    <span class="rack__title t-label-eyebrow" aria-hidden="true">{{ name }}</span>
    <ul ref="list" class="rack__servers">
      <li v-for="(server, index) in servers" :key="server.name">
        <RackServer
          :name="server.name"
          :term="server.term"
          :pressed="index === selected"
          :expanded="expandable ? open && index === selected : undefined"
          :focusable="index === active"
          :data-server="server.name"
          @click="select(index)"
          @keydown="onKeydown($event, index)"
          @focus="active = index"
        />
      </li>
    </ul>
  </div>
</template>

<style scoped>
.rack {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  box-sizing: border-box;
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-surface-alt);
}

.rack__title {
  color: var(--text-secondary);
}

.rack__servers {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
