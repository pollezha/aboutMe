// Геометрия острова из концепта (scripts/design/scene-layout.json) в единицах three.js.
// Плоскость концепта 1100×1100 px, x → восток, y → юг; 1 unit = 10 px, центр острова в начале координат:
// x концепта → +X, y концепта → +Z, высота → +Y.
import layout from '../../scripts/design/scene-layout.json'
import type { ChapterId } from '../content/chapters'

export const PX_PER_UNIT = 10
const HALF = layout.canvas.w / 2

export interface Box {
  /** Центр основания. */
  position: [number, number, number]
  /** Ширина (X), высота (Y), глубина (Z). */
  size: [number, number, number]
}

interface Rect {
  x: number
  y: number
  w: number
  d: number
  h?: number
}

/** Прямоугольник плоскости концепта → коробка, стоящая на высоте `base`. */
export function toBox({ x, y, w, d, h = 0 }: Rect, base = 0, minHeight = 0): Box {
  const height = Math.max(h / PX_PER_UNIT, minHeight)
  return {
    position: [
      (x + w / 2 - HALF) / PX_PER_UNIT,
      base + height / 2,
      (y + d / 2 - HALF) / PX_PER_UNIT,
    ],
    size: [w / PX_PER_UNIT, height, d / PX_PER_UNIT],
  }
}

/** Сторона острова в units (вся плоскость концепта — суша). */
export const ISLAND_SIZE = layout.canvas.w / PX_PER_UNIT

export const LAND_HEIGHT = 1.2
/** Толщина плоских слоёв (плита, площадки, дороги). */
export const LAYER = 0.12

/** Плоский слой: у плит и дорог в концепте `h` — глубина по плоскости, а не высота. */
function flat({ x, y, w, h }: { x: number; y: number; w: number; h: number }, thickness: number) {
  return toBox({ x, y, w, d: h }, LAND_HEIGHT, thickness)
}

export const island = {
  land: toBox({ x: 0, y: 0, w: layout.canvas.w, d: layout.canvas.h }, 0, LAND_HEIGHT),
  plate: flat(layout.island.plate, LAYER),
  core: flat(layout.island.core, LAYER * 2),
}

export const roads: Box[] = layout.roads.map((road) => flat(road, LAYER))

/** Подпись висит над самой высокой коробкой остановки на этой высоте (units). */
export const LABEL_CLEARANCE = 3

export interface Stop {
  id: ChapterId
  pad: Box
  /** Главное здание — первая коробка концепта. */
  building: Box
  /** Все коробки остановки без точных дублей (в концепте дубль лишь перекрашивал крышу). */
  boxes: Box[]
  /** Точка подписи в мире: над якорем остановки, выше её крыши. */
  label: [number, number, number]
}

const STOP_BASE = LAND_HEIGHT + LAYER

export const stops: Stop[] = layout.stops.map((stop) => {
  const seen = new Set<string>()
  const boxes = stop.buildings
    .filter(({ x, y, w, d, h }) => {
      const key = [x, y, w, d, h].join()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((rect) => toBox(rect, STOP_BASE))
  const [main] = boxes
  if (!main) throw new Error(`scene-layout: stop ${stop.id} has no buildings`)
  const roof = Math.max(...boxes.map((box) => box.position[1] + box.size[1] / 2))
  return {
    id: stop.id as ChapterId,
    pad: toBox(stop.pad, LAND_HEIGHT, LAYER),
    building: main,
    boxes,
    label: [
      (stop.anchor.x - HALF) / PX_PER_UNIT,
      roof + LABEL_CLEARANCE,
      (stop.anchor.y - HALF) / PX_PER_UNIT,
    ],
  }
})
