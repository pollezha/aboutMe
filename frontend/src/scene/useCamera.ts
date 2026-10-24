// Поворот карты (FR2): четверть оборота камеры по орбите вокруг центра острова.
// Чистая логика без three/TresJS: модуль импортирует и app/TopBar.vue (кнопка в HTML-слое, main-чанк),
// и сцена (анимация в useLoop) — состояние поворота общее, анимация — только в сцене.
import { readonly, ref, type Ref } from 'vue'

export type Rotation = 0 | 90 | 180 | 270
/** 1 — следующая четверть, -1 — предыдущая. */
export type RotateDirection = 1 | -1

export const ROTATE_DURATION_MS = 300
/** Азимут изометрии при повороте 0: камера на диагонали (1, 1, 1), как в спайке T7. */
export const ISO_AZIMUTH_DEG = 45
/** Угол над горизонтом у изометрии: atan(1 / √2) ≈ 35.26°. */
export const ISO_ELEVATION = Math.atan(1 / Math.SQRT2)

export interface MapRotation {
  rotation: Readonly<Ref<Rotation>>
  rotate: (direction?: RotateDirection) => void
}

export function createMapRotation(): MapRotation {
  const rotation = ref<Rotation>(0)
  return {
    rotation: readonly(rotation),
    rotate(direction = 1) {
      rotation.value = ((((rotation.value + direction * 90) % 360) + 360) % 360) as Rotation
    },
  }
}

/** Общий поворот карты: кнопка/клавиша R в HTML-слое меняют его, камера сцены следует за ним. */
export const mapRotation = createMapRotation()

/** Позиция камеры на орбите вокруг начала координат; азимут отсчитывается от +Z к +X. */
export function cameraPosition(azimuthDeg: number, distance: number): [number, number, number] {
  const azimuth = (azimuthDeg * Math.PI) / 180
  const ground = distance * Math.cos(ISO_ELEVATION)
  return [
    ground * Math.sin(azimuth),
    distance * Math.sin(ISO_ELEVATION),
    ground * Math.cos(azimuth),
  ]
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

/** Кратчайшая разница углов в (-180, 180]: 270 → 0 — это +90, а не -270. */
function turn(from: Rotation, to: Rotation) {
  const diff = (((to - from) % 360) + 360) % 360
  return diff > 180 ? diff - 360 : diff
}

export interface CameraOptions {
  map?: MapRotation
  distance: number
  /** true — без анимации (prefers-reduced-motion или пауза движения). Читается на каждом шаге. */
  instant: () => boolean
}

export function useCamera({ map = mapRotation, distance, instant }: CameraOptions) {
  let seen = map.rotation.value
  let from = ISO_AZIMUTH_DEG + seen
  let to = from
  let current = from
  let elapsed = 0

  /** Шаг анимации; вызывается из useLoop каждый кадр с прошедшим временем в мс. */
  function step(deltaMs: number) {
    const rotation = map.rotation.value
    if (rotation !== seen) {
      to += turn(seen, rotation)
      seen = rotation
      from = current
      elapsed = 0
    }
    if (current === to) return
    elapsed += deltaMs
    const t = instant() ? 1 : Math.min(1, elapsed / ROTATE_DURATION_MS)
    current = t >= 1 ? to : from + (to - from) * easeInOut(t)
  }

  return {
    rotation: map.rotation,
    rotate: map.rotate,
    step,
    azimuth: () => current,
    position: () => cameraPosition(current, distance),
  }
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable || target.contentEditable === 'true') return true
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

/** Клавиша R поворачивает карту, но не в полях ввода, не с модификаторами и не при открытом окне. */
export function isRotateHotkey(event: KeyboardEvent, dialogOpen: boolean) {
  if (dialogOpen || event.ctrlKey || event.metaKey || event.altKey) return false
  if (event.key !== 'r' && event.key !== 'R') return false
  return !isTypingTarget(event.target)
}
