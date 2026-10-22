<script setup lang="ts">
// Фоновые домики: один InstancedMesh — один draw call на все дома. Раскладка детерминирована (houses.ts),
// цвета экземпляров — из scene/* текущей темы.
import { BoxGeometry, Color, InstancedMesh, MeshLambertMaterial, Object3D } from 'three'
import { onBeforeUnmount, shallowRef, watch } from 'vue'
import { houseColors, type ThemeColors } from '../materials'
import { HOUSE_SEED, placeHouses } from './houses'

const props = defineProps<{ geometry: BoxGeometry; colors: ThemeColors }>()

const houses = placeHouses(HOUSE_SEED)
// Белый базовый цвет: итоговый цвет дома — цвет экземпляра.
const material = new MeshLambertMaterial()
const mesh = shallowRef<InstancedMesh>()

function layoutHouses(target: InstancedMesh) {
  const dummy = new Object3D()
  houses.forEach((house, i) => {
    dummy.position.set(...house.position)
    dummy.scale.set(...house.size)
    dummy.updateMatrix()
    target.setMatrixAt(i, dummy.matrix)
  })
  target.instanceMatrix.needsUpdate = true
  target.computeBoundingSphere()
}

function paint(target: InstancedMesh, colors: ThemeColors) {
  const swatches = houseColors(colors).map((hex) => new Color(hex))
  houses.forEach((_, i) => target.setColorAt(i, swatches[i % swatches.length]!))
  if (target.instanceColor) target.instanceColor.needsUpdate = true
}

let laidOut: InstancedMesh | undefined
watch(
  [mesh, () => props.colors],
  ([target, colors]) => {
    if (!target) return
    if (target !== laidOut) layoutHouses(target)
    laidOut = target
    paint(target, colors)
  },
  { immediate: true },
)

onBeforeUnmount(() => material.dispose())
</script>

<template>
  <TresInstancedMesh ref="mesh" :args="[geometry, material, houses.length]" />
</template>
