<script setup lang="ts">
// Корень ленивого чанка сцены: всё, что тянет three/TresJS, импортируется отсюда и только отсюда.
import { TresCanvas } from '@tresjs/core'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useUiStore } from '../stores/ui'
import { palette } from '../theme/palette'
import SceneContent from './SceneContent.vue'
import { isRotateHotkey, mapRotation } from './useCamera'

defineOptions({ name: 'IslandScene' })

const emit = defineEmits<{ ready: [] }>()

const ui = useUiStore()
const sky = computed(() => palette[ui.theme]['scene/sky'])
const hovered = ref(false)

let firstFrame = true
function onRender() {
  if (!firstFrame) return
  firstFrame = false
  emit('ready')
}

// Клавиша R — поворот карты (tooltip кнопки «Rotate map · R»); живёт, пока на экране сцена.
function onKeydown(event: KeyboardEvent) {
  if (!isRotateHotkey(event, ui.openWindow !== null)) return
  event.preventDefault()
  mapRotation.rotate()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="scene" :class="{ 'scene--pointer': hovered }" aria-hidden="true">
    <TresCanvas :clear-color="sky" :dpr="[1, 2]" render-mode="always" @render="onRender">
      <SceneContent @hover="hovered = $event" />
    </TresCanvas>
  </div>
</template>

<style scoped>
.scene {
  position: absolute;
  inset: 0;
}

.scene--pointer {
  cursor: pointer;
}
</style>
