<script setup lang="ts">
// Корень ленивого чанка сцены: всё, что тянет three/TresJS, импортируется отсюда и только отсюда.
import { TresCanvas } from '@tresjs/core'
import { computed } from 'vue'
import { useUiStore } from '../stores/ui'
import { palette } from '../theme/palette'
import SceneContent from './SceneContent.vue'

defineOptions({ name: 'IslandScene' })

const emit = defineEmits<{ ready: [] }>()

const ui = useUiStore()
const sky = computed(() => palette[ui.theme]['scene/sky'])

let firstFrame = true
function onRender() {
  if (!firstFrame) return
  firstFrame = false
  emit('ready')
}
</script>

<template>
  <div class="scene" aria-hidden="true">
    <TresCanvas :clear-color="sky" :dpr="[1, 2]" render-mode="always" @render="onRender">
      <SceneContent />
    </TresCanvas>
  </div>
</template>

<style scoped>
.scene {
  position: absolute;
  inset: 0;
}
</style>
