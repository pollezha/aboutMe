// Фоновые домики (не остановки): детерминированная раскладка по сетке плиты острова.
// Случайность только из seed — один и тот же город при каждой загрузке и в каждом рендере.
import { LAND_HEIGHT, LAYER, island, roads, stops, type Box } from '../layout'

export const HOUSE_SEED = 20261023
export const HOUSE_COUNT = 30
/** Шаг сетки по плите (units): в клетке — не больше одного дома. */
const CELL = 8
/** Зазор от края клетки: дома не касаются друг друга и края плиты. */
const MARGIN = 0.8
const MIN_SIDE = 2.6
const MAX_SIDE = CELL - 2 * MARGIN
const MIN_HEIGHT = 1.4
const MAX_HEIGHT = 5.5
/** Свободная полоса вокруг ядра острова (там площадь и будущая сцена мониторинга). */
const CORE_CLEARANCE = 1.5

/** mulberry32: маленький детерминированный ГПСЧ. */
function random(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Rect {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

function rectOf({ position: [x, , z], size: [w, , d] }: Box, grow = 0): Rect {
  return {
    minX: x - w / 2 - grow,
    maxX: x + w / 2 + grow,
    minZ: z - d / 2 - grow,
    maxZ: z + d / 2 + grow,
  }
}

function overlaps(a: Rect, b: Rect) {
  return a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ
}

export function placeHouses(seed: number, count = HOUSE_COUNT): Box[] {
  const next = random(seed)
  const plate = rectOf(island.plate)
  const blocked = [
    rectOf(island.core, CORE_CLEARANCE),
    ...roads.map((road) => rectOf(road)),
    ...stops.map((stop) => rectOf(stop.pad)),
  ]
  const base = LAND_HEIGHT + LAYER

  const cells: Rect[] = []
  for (let x = plate.minX; x + CELL <= plate.maxX + 1e-9; x += CELL) {
    for (let z = plate.minZ; z + CELL <= plate.maxZ + 1e-9; z += CELL) {
      const cell = { minX: x, maxX: x + CELL, minZ: z, maxZ: z + CELL }
      if (!blocked.some((zone) => overlaps(cell, zone))) cells.push(cell)
    }
  }

  // Фишер — Йейтс по seed: какие клетки застроены.
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[cells[i], cells[j]] = [cells[j]!, cells[i]!]
  }

  return cells.slice(0, count).map((cell) => {
    const w = MIN_SIDE + next() * (MAX_SIDE - MIN_SIDE)
    const d = MIN_SIDE + next() * (MAX_SIDE - MIN_SIDE)
    const h = MIN_HEIGHT + next() * (MAX_HEIGHT - MIN_HEIGHT)
    const x = cell.minX + MARGIN + w / 2 + next() * (CELL - 2 * MARGIN - w)
    const z = cell.minZ + MARGIN + d / 2 + next() * (CELL - 2 * MARGIN - d)
    return { position: [x, base + h / 2, z], size: [w, h, d] }
  })
}
