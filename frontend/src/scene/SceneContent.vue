<script setup lang="ts">
// Остров: ортокамера на орбите (поворот — useCamera), свет, вода, суша, дороги, здания остановок
// с подписями, фоновые домики и грузовик (Truck.vue). Цвета только из palette (TC-08).
import { useLoop, useTres } from '@tresjs/core'
import { BoxGeometry, type OrthographicCamera } from 'three'
import { computed, onBeforeUnmount, shallowRef } from 'vue'
import { useUiStore } from '../stores/ui'
import { palette, useThemeStore } from '../theme'
import BackgroundHouses from './buildings/BackgroundHouses.vue'
import Building from './buildings/Building.vue'
import { ISLAND_FRAMING, OVERLAY_FRAMING } from './framing'
import Labels from './Labels.vue'
import { ISLAND_SIZE, island, roads, stops } from './layout'
import { createSceneMaterials } from './materials'
import { chapterClickHandler } from './pick'
import Truck from './Truck.vue'
import { useCamera } from './useCamera'

const props = withDefaults(
  defineProps<{
    /** overlay — первый экран под HTML-слоем; island — рендер острова для 2D-карты, без подписей. */
    framing?: 'overlay' | 'island'
  }>(),
  { framing: 'overlay' },
)

const emit = defineEmits<{ hover: [boolean] }>()

const frame = props.framing === 'island' ? ISLAND_FRAMING : OVERLAY_FRAMING
const VIEW_HALF_HEIGHT = frame.halfHeight
const CAMERA_DISTANCE = 200 * Math.sqrt(3)
const WATER_SIZE = ISLAND_SIZE * 8

const { sizes } = useTres()
const ui = useUiStore()
const themeStore = useThemeStore()
const colors = computed(() => palette[themeStore.theme])
const materials = createSceneMaterials(() => colors.value)
// Единичный куб на все коробки сцены: размер — через scale.
const box = new BoxGeometry(1, 1, 1)

const aspect = computed(() => sizes.aspectRatio.value || 1)
const halfWidth = computed(() => VIEW_HALF_HEIGHT * aspect.value)
const shiftX = frame.centerX
const shiftY = frame.centerY

const reducedMotion =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null
/** Без анимации (поворот камеры, грузовик): prefers-reduced-motion или пауза движения. */
const instant = () => !!reducedMotion?.matches || ui.motionPaused
const rig = useCamera({ distance: CAMERA_DISTANCE, instant })
const camera = shallowRef<OrthographicCamera>()
const initialPosition = rig.position()

const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => {
  const target = camera.value
  if (!target) return
  rig.step(delta * 1000)
  target.position.set(...rig.position())
  target.lookAt(0, 0, 0)
})

const onClick = chapterClickHandler((id) => ui.openChapter(id))

onBeforeUnmount(() => {
  materials.dispose()
  box.dispose()
})
</script>

<template>
  <!-- Изометрия: камера на диагонали (1, 1, 1) смотрит в центр острова; поворот — по орбите. -->
  <TresOrthographicCamera
    ref="camera"
    :left="-halfWidth + shiftX"
    :right="halfWidth + shiftX"
    :top="VIEW_HALF_HEIGHT + shiftY"
    :bottom="-VIEW_HALF_HEIGHT + shiftY"
    :near="1"
    :far="1000"
    :position="initialPosition"
    :look-at="[0, 0, 0]"
  />
  <TresAmbientLight :intensity="1.6" />
  <TresDirectionalLight :position="[60, 120, 40]" :intensity="1.8" />

  <TresMesh :rotation-x="-Math.PI / 2" :position-y="-0.01" :material="materials.get('sea')">
    <TresPlaneGeometry :args="[WATER_SIZE, WATER_SIZE]" />
  </TresMesh>

  <TresMesh
    :geometry="box"
    :material="materials.get('sand')"
    :position="island.land.position"
    :scale="island.land.size"
  />
  <TresMesh
    :geometry="box"
    :material="materials.get('ground')"
    :position="island.plate.position"
    :scale="island.plate.size"
  />
  <TresMesh
    :geometry="box"
    :material="materials.get('sand')"
    :position="island.core.position"
    :scale="island.core.size"
  />
  <TresMesh
    v-for="(road, i) in roads"
    :key="`road-${i}`"
    :geometry="box"
    :material="materials.get('road')"
    :position="road.position"
    :scale="road.size"
  />

  <BackgroundHouses :geometry="box" :colors="colors" />

  <TresGroup
    @click="onClick"
    @pointerenter="emit('hover', true)"
    @pointerleave="emit('hover', false)"
  >
    <Building
      v-for="stop in stops"
      :key="stop.id"
      :stop="stop"
      :geometry="box"
      :materials="materials"
    />
  </TresGroup>

  <Truck :geometry="box" :materials="materials" :instant="instant" />

  <Labels v-if="framing === 'overlay'" />
</template>
