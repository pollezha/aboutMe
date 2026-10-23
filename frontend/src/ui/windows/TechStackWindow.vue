<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveChapter, serverTenure } from '../../content/format'
import type { ContentBundle } from '../../content/types'
import { useBreakpoint } from '../useBreakpoint'
import BottomSheet from './blocks/BottomSheet.vue'
import Rack from './blocks/Rack.vue'
import ServerDetails from './blocks/ServerDetails.vue'
import WindowColumns from './blocks/WindowColumns.vue'

// Figma Window/04 Tech stack (figma-windows.md §04): стойки слева, панель выбранного сервера справа;
// < 768 — стойки в одну колонку, детали в bottom-sheet. Срок сервера считается из дат ролей `usedIn`.
const props = withDefaults(defineProps<{ content: ContentBundle; now?: Date }>(), {
  now: () => new Date(),
})

const { t } = useI18n()
const breakpoint = useBreakpoint()
const mobile = computed(() => breakpoint.value === 'mobile')

const chapter = computed(() => resolveChapter(props.content, 'techstack', props.now))
const racks = computed(() =>
  chapter.value.racks.map((rack) => ({
    name: rack.name,
    servers: rack.servers.map((server) => ({
      ...server,
      ...serverTenure(server.usedIn, props.content.experience, props.now, props.content.lang),
    })),
  })),
)

// По умолчанию выбран первый сервер первой стойки (валидатор гарантирует непустые стойки).
const selected = ref({ rack: 0, server: 0 })
const current = computed(
  () =>
    racks.value[selected.value.rack]?.servers[selected.value.server] ?? racks.value[0]!.servers[0]!,
)
const sheetOpen = ref(false)
const nameId = useId()
const root = ref<HTMLElement | null>(null)

function select(rack: number, server: number) {
  selected.value = { rack, server }
  if (mobile.value) sheetOpen.value = true
}

async function closeSheet() {
  sheetOpen.value = false
  await nextTick()
  const button = root.value
    ?.querySelectorAll<HTMLElement>('.rack')
    [selected.value.rack]?.querySelectorAll<HTMLElement>('.rack-server')[selected.value.server]
  button?.focus()
}

const details = computed(() => ({
  name: current.value.name,
  nameId,
  term: current.value.term,
  tenure: current.value.label,
  where: current.value.where,
  what: current.value.what,
  experienceLabel: chapter.value.experienceLabel,
  whereLabel: chapter.value.whereLabel,
  whatLabel: chapter.value.whatLabel,
}))
</script>

<template>
  <div ref="root" class="chapter-body">
    <WindowColumns class="techstack">
      <div class="techstack__racks" :class="{ 'techstack__racks--single': mobile }">
        <Rack
          v-for="(rack, index) in racks"
          :key="rack.name"
          :name="rack.name"
          :servers="rack.servers"
          :selected="selected.rack === index ? selected.server : -1"
          :expandable="mobile"
          :open="sheetOpen"
          @select="select(index, $event)"
        />
      </div>
      <section v-if="!mobile" class="techstack__panel" aria-live="polite">
        <ServerDetails v-bind="details" />
      </section>
    </WindowColumns>
    <BottomSheet v-if="mobile && sheetOpen" :labelled-by="nameId" @close="closeSheet">
      <ServerDetails
        v-bind="details"
        variant="sheet"
        :close-label="t('window.close')"
        @close="closeSheet"
      />
    </BottomSheet>
  </div>
</template>

<style scoped>
@media (width >= 768px) {
  .techstack {
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  }
}

.techstack__racks {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.techstack__racks--single {
  grid-template-columns: minmax(0, 1fr);
}

.techstack__panel {
  position: sticky;
  top: 0;
  padding: var(--space-4);
  border: 2px solid var(--accent);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}
</style>
