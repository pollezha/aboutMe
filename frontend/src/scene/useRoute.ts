// Маршрут грузовика (FR3, design §4 «Навигация и грузовик»). Чистая логика без three/TresJS:
// граф дороги — кольцо из 4 путевых точек концепта, у каждой остановки — «парковка» на кольце
// (проекция якоря площадки на ближайший отрезок). Грузовик едет по короткой дуге с постоянной
// скоростью; новая цель во время езды строит маршрут от текущей точки; instant — телепорт.
// Координаты — плоскость острова в units (x → восток, z → юг), как в layout.ts.
import layout from '../../scripts/design/scene-layout.json'
import { ROUTE, type ChapterId } from '../content'
import { PX_PER_UNIT } from './layout'

export interface Point {
  x: number
  z: number
}

/** Остановки маршрута; у Summary и Monitoring здания нет — грузовик к ним не едет. */
export type RouteStopId = Exclude<ChapterId, 'monitoring' | 'summary'>

export interface TruckState {
  position: Point
  /** Курс в плоскости x/z: atan2(dz, dx) направления движения; 0 — на восток. */
  heading: number
  /** Оставшиеся точки маршрута (без текущей позиции); пусто — стоит. */
  path: Point[]
}

/**
 * Скорость в units/с. Самая длинная поездка — полкольца (≈ 148 units) — укладывается в 3 с, соседние
 * остановки — около секунды: грузовик доезжает, пока читают начало окна.
 */
export const TRUCK_SPEED = 50

const HALF = layout.canvas.w / 2
const toUnits = ({ x, y }: { x: number; y: number }): Point => ({
  x: (x - HALF) / PX_PER_UNIT,
  z: (y - HALF) / PX_PER_UNIT,
})

/** Кольцо дороги по часовой стрелке (вид сверху): NW → NE → SE → SW. */
export const RING: readonly Point[] = layout.roadRingWaypoints.map(toUnits)
export const TRUCK_START: Point = toUnits(layout.truckStart)

const EPS = 1e-9

function distance(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.z - a.z)
}

function same(a: Point, b: Point) {
  return distance(a, b) < 1e-6
}

function corner(i: number): Point {
  const n = RING.length
  return RING[((i % n) + n) % n]!
}

/** Длины отрезков кольца и их начала по дуге (s = 0 в RING[0]). */
const SEGMENT_LENGTHS = RING.map((point, i) => distance(point, corner(i + 1)))
const SEGMENT_STARTS = SEGMENT_LENGTHS.map((_, i) =>
  SEGMENT_LENGTHS.slice(0, i).reduce((sum, length) => sum + length, 0),
)
const RING_LENGTH = SEGMENT_LENGTHS.reduce((sum, length) => sum + length, 0)

interface RingPosition {
  segment: number
  /** Длина дуги от RING[0] по ходу кольца. */
  s: number
  point: Point
}

/** Ближайшая точка кольца: проекция на каждый отрезок, берём ближайшую. */
function project(p: Point): RingPosition {
  let best: RingPosition & { gap: number } = { segment: 0, s: 0, point: corner(0), gap: Infinity }
  RING.forEach((a, i) => {
    const b = corner(i + 1)
    const length = SEGMENT_LENGTHS[i]!
    const t =
      length < EPS
        ? 0
        : Math.min(
            1,
            Math.max(0, ((p.x - a.x) * (b.x - a.x) + (p.z - a.z) * (b.z - a.z)) / length ** 2),
          )
    const point = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }
    const gap = distance(p, point)
    if (gap < best.gap - EPS) best = { segment: i, s: SEGMENT_STARTS[i]! + t * length, point, gap }
  })
  return best
}

const ROUTE_STOP_IDS = ROUTE.map((chapter) => chapter.id) as RouteStopId[]

export function isRouteStop(id: ChapterId): id is RouteStopId {
  return (ROUTE_STOP_IDS as ChapterId[]).includes(id)
}

const PARKING = new Map<RouteStopId, RingPosition>(
  layout.stops
    .filter((stop) => isRouteStop(stop.id as ChapterId))
    .map((stop) => [stop.id as RouteStopId, project(toUnits(stop.anchor))]),
)

function parkingPosition(id: RouteStopId): RingPosition {
  const found = PARKING.get(id)
  if (!found) throw new Error(`scene-layout: stop ${id} has no anchor`)
  return found
}

/** Точка парковки остановки на кольце. */
export function parking(id: RouteStopId): Point {
  return parkingPosition(id).point
}

/**
 * Маршрут от `from` к парковке `to` по короткой дуге кольца: [from, (проекция на кольцо), углы…, парковка].
 * Ничья дуг — по ходу кольца. Совпадающие соседние точки схлопываются.
 */
export function planRoute(from: Point, to: RouteStopId): Point[] {
  const start = project(from)
  const end = parkingPosition(to)
  const ahead = (((end.s - start.s) % RING_LENGTH) + RING_LENGTH) % RING_LENGTH
  const forward = ahead <= RING_LENGTH / 2

  const corners: Point[] = []
  if (ahead > EPS && RING_LENGTH - ahead > EPS) {
    // Вперёд: углы в начале следующих отрезков; назад: углы в начале текущих, по убыванию.
    // Сколько углов пересекаем — разница номеров отрезков по направлению движения.
    const n = RING.length
    if (forward) {
      const count = (end.segment - start.segment + n) % n
      const wraps = count === 0 && end.s < start.s
      for (let k = 1; k <= (wraps ? n : count); k++) corners.push(corner(start.segment + k))
    } else {
      const count = (start.segment - end.segment + n) % n
      const wraps = count === 0 && end.s > start.s
      for (let k = 0; k < (wraps ? n : count); k++) corners.push(corner(start.segment - k))
    }
  }

  const route: Point[] = [from]
  for (const point of [start.point, ...corners, end.point]) {
    if (!same(route[route.length - 1]!, point)) route.push(point)
  }
  return route
}

export function createTruck(start: Point = TRUCK_START): TruckState {
  // Стоит на западной дороге носом на север (к первой остановке).
  return { position: start, heading: Math.atan2(-1, 0), path: [] }
}

/** Новая цель — и с места, и посреди езды: маршрут строится от текущей точки. */
export function driveTo(state: TruckState, to: RouteStopId): TruckState {
  return { ...state, path: planRoute(state.position, to).slice(1) }
}

function headingOf(from: Point, to: Point) {
  return Math.atan2(to.z - from.z, to.x - from.x)
}

export interface AdvanceOptions {
  /** prefers-reduced-motion или пауза движения: позиция = цель сразу. */
  instant?: boolean
}

/** Шаг движения на dtMs: TRUCK_SPEED units/с вдоль маршрута, остаток пути переносится через углы. */
export function advance(state: TruckState, dtMs: number, { instant = false }: AdvanceOptions = {}) {
  if (state.path.length === 0) return state

  if (instant) {
    const target = state.path[state.path.length - 1]!
    const before = state.path[state.path.length - 2] ?? state.position
    const heading = same(before, target) ? state.heading : headingOf(before, target)
    return { position: target, heading, path: [] }
  }

  let budget = (TRUCK_SPEED * Math.max(0, dtMs)) / 1000
  let { position, heading } = state
  const path = [...state.path]
  while (budget > 0 && path.length > 0) {
    const next = path[0]!
    const gap = distance(position, next)
    if (gap > EPS) heading = headingOf(position, next)
    if (gap <= budget) {
      position = next
      budget -= gap
      path.shift()
    } else {
      const t = budget / gap
      position = {
        x: position.x + (next.x - position.x) * t,
        z: position.z + (next.z - position.z) * t,
      }
      budget = 0
    }
  }
  return { position, heading, path }
}
