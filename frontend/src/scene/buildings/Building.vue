<script setup lang="ts">
// Здание остановки: площадка + коробки из scene-layout.json. Стены — цвет главы, у пристроек — светлее,
// у всех коробок плоская крыша-плита. Геометрия одна на всю сцену (единичный куб, масштаб — размером),
// материалы общие (materials.ts); userData.chapter на группе — для pickChapter при клике.
import type { BoxGeometry } from 'three'
import { computed } from 'vue'
import type { Stop } from '../layout'
import type { createSceneMaterials } from '../materials'

defineOptions({ name: 'StopBuilding' })

const props = defineProps<{
  stop: Stop
  geometry: BoxGeometry
  materials: ReturnType<typeof createSceneMaterials>
}>()

/** Толщина крыши-плиты (units). */
const ROOF = 0.35

const parts = computed(() =>
  props.stop.boxes.map((box, i) => {
    const [x, y, z] = box.position
    const [w, h, d] = box.size
    const roof = Math.min(ROOF, h / 3)
    const wallHeight = h - roof
    const bottom = y - h / 2
    return {
      wall: {
        position: [x, bottom + wallHeight / 2, z] as const,
        scale: [w, wallHeight, d] as const,
        material: props.materials.get(i === 0 ? `wall:${props.stop.id}` : `annex:${props.stop.id}`),
      },
      roof: {
        position: [x, bottom + wallHeight + roof / 2, z] as const,
        scale: [w, roof, d] as const,
        material: props.materials.get(`roof:${props.stop.id}`),
      },
    }
  }),
)
</script>

<template>
  <TresGroup :user-data="{ chapter: stop.id }">
    <TresMesh
      :geometry="geometry"
      :material="materials.get('pad')"
      :position="stop.pad.position"
      :scale="stop.pad.size"
    />
    <template v-for="(part, i) in parts" :key="i">
      <TresMesh
        :geometry="geometry"
        :material="part.wall.material"
        :position="part.wall.position"
        :scale="part.wall.scale"
      />
      <TresMesh
        :geometry="geometry"
        :material="part.roof.material"
        :position="part.roof.position"
        :scale="part.roof.scale"
      />
    </template>
  </TresGroup>
</template>
