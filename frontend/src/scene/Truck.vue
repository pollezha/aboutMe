<script setup lang="ts">
// Грузовик (FR3): рама, кузов и кабина из общего единичного куба, модель вдоль +X.
// Открытие главы маршрута отправляет его к остановке (окно уже открыто — он едет фоном, D5);
// клик во время езды перенаправляет с текущей точки; instant (reduced-motion/пауза) — телепорт.
// Состояние маршрута — обычная переменная, а не ref: кадр двигает группу напрямую, без реактивности.
import { useLoop } from '@tresjs/core'
import type { BoxGeometry, Group } from 'three'
import { shallowRef, watch } from 'vue'
import { useUiStore } from '../stores/ui'
import { LAND_HEIGHT, LAYER } from './layout'
import type { createSceneMaterials } from './materials'
import { advance, createTruck, driveTo, isRouteStop, type TruckState } from './useRoute'

defineOptions({ name: 'RouteTruck' })

const props = defineProps<{
  geometry: BoxGeometry
  materials: ReturnType<typeof createSceneMaterials>
  /** true — без анимации; читается каждый кадр. */
  instant: () => boolean
}>()

/** Грузовик стоит на дороге. */
const ROAD_TOP = LAND_HEIGHT + LAYER

const parts = [
  { role: 'truck:chassis', position: [0, 0.55, 0], scale: [5.4, 0.5, 2.4] },
  { role: 'truck:cargo', position: [-0.9, 1.75, 0], scale: [3.4, 1.9, 2.4] },
  { role: 'truck:cab', position: [1.75, 1.5, 0], scale: [1.7, 1.4, 2.3] },
] as const

const ui = useUiStore()
const group = shallowRef<Group>()
let truck: TruckState = createTruck()

function place() {
  const target = group.value
  if (!target) return
  target.position.set(truck.position.x, ROAD_TOP, truck.position.z)
  // Поворот вокруг +Y на θ ведёт +X в (cos θ, −sin θ) по x/z, курс — atan2(dz, dx): θ = −курс.
  target.rotation.y = -truck.heading
}

watch(
  () => ui.openWindow,
  (id) => {
    if (id && isRouteStop(id)) truck = driveTo(truck, id)
  },
  { immediate: true },
)

const { onBeforeRender } = useLoop()
// Ставим группу каждый кадр (три присваивания): ref появляется после монтирования, а стоящий
// грузовик тоже должен оказаться на старте.
onBeforeRender(({ delta }) => {
  if (truck.path.length > 0) truck = advance(truck, delta * 1000, { instant: props.instant() })
  place()
})
</script>

<template>
  <TresGroup ref="group">
    <TresMesh
      v-for="part in parts"
      :key="part.role"
      :geometry="geometry"
      :material="materials.get(part.role)"
      :position="part.position"
      :scale="part.scale"
    />
  </TresGroup>
</template>
