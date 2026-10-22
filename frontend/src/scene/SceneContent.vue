<script setup lang="ts">
// Spike T7: ортокамера, свет, вода, суша, дороги и по коробке на остановку. Здания, подписи,
// клик и поворот — T8; грузовик — T9. Цвета только из palette (TC-08).
import { useTres } from '@tresjs/core'
import { computed } from 'vue'
import { useUiStore } from '../stores/ui'
import { palette } from '../theme/palette'
import { ISLAND_SIZE, island, roads, stops } from './layout'

/** Половина высоты кадра в units: остров (≈ 155 по диагонали) целиком помещается с запасом. */
const VIEW_HALF_HEIGHT = 62
const CAMERA_DISTANCE = 200
const WATER_SIZE = ISLAND_SIZE * 8

const { sizes } = useTres()
const ui = useUiStore()
const colors = computed(() => palette[ui.theme])

const aspect = computed(() => sizes.aspectRatio.value || 1)
const halfWidth = computed(() => VIEW_HALF_HEIGHT * aspect.value)
</script>

<template>
  <!-- Изометрия: камера на диагонали (1, 1, 1) смотрит в центр острова. -->
  <TresOrthographicCamera
    :left="-halfWidth"
    :right="halfWidth"
    :top="VIEW_HALF_HEIGHT"
    :bottom="-VIEW_HALF_HEIGHT"
    :near="1"
    :far="1000"
    :position="[CAMERA_DISTANCE, CAMERA_DISTANCE, CAMERA_DISTANCE]"
    :look-at="[0, 0, 0]"
  />
  <TresAmbientLight :intensity="1.6" />
  <TresDirectionalLight :position="[60, 120, 40]" :intensity="1.8" />

  <TresMesh :rotation-x="-Math.PI / 2" :position-y="-0.01">
    <TresPlaneGeometry :args="[WATER_SIZE, WATER_SIZE]" />
    <TresMeshLambertMaterial :color="colors['scene/sea']" />
  </TresMesh>

  <TresMesh :position="island.land.position">
    <TresBoxGeometry :args="island.land.size" />
    <TresMeshLambertMaterial :color="colors['scene/sand']" />
  </TresMesh>
  <TresMesh :position="island.plate.position">
    <TresBoxGeometry :args="island.plate.size" />
    <TresMeshLambertMaterial :color="colors['scene/ground']" />
  </TresMesh>
  <TresMesh :position="island.core.position">
    <TresBoxGeometry :args="island.core.size" />
    <TresMeshLambertMaterial :color="colors['scene/sand']" />
  </TresMesh>

  <TresMesh v-for="(road, i) in roads" :key="`road-${i}`" :position="road.position">
    <TresBoxGeometry :args="road.size" />
    <TresMeshLambertMaterial :color="colors['scene/road']" />
  </TresMesh>

  <template v-for="stop in stops" :key="stop.id">
    <TresMesh :position="stop.pad.position">
      <TresBoxGeometry :args="stop.pad.size" />
      <TresMeshLambertMaterial :color="colors['scene/ground']" />
    </TresMesh>
    <TresMesh :position="stop.building.position">
      <TresBoxGeometry :args="stop.building.size" />
      <TresMeshLambertMaterial :color="colors[`chapter/${stop.id}`]" />
    </TresMesh>
  </template>
</template>
