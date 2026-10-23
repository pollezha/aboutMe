// Кадр ортокамеры сцены. Чистая математика без three: модуль импортирует сцена (кадр камеры) и тест
// 2D-карты (хотспоты figma-2d-map.json против проекции зданий на рендер острова, npm run island).
// Координаты кадра — «вид» камеры: x вправо, y вверх по экрану, в units сцены (ортопроекция).
import { ROUTE, type ChapterId } from '../content/chapters'
import { HOUSE_SEED, placeHouses } from './buildings/houses'
import { island, stops, type Box } from './layout'
import { ISO_AZIMUTH_DEG, cameraPosition } from './useCamera'

export interface Framing {
  /** Половина высоты кадра, units; ширина — по соотношению сторон вьюпорта. */
  halfHeight: number
  /** Центр кадра в координатах вида. */
  centerX: number
  centerY: number
}

/**
 * Первый экран: кадр сдвинут (экранно, поэтому при повороте карты остров стоит на месте) вправо — от Hero
 * (400 px слева сверху, figma-state heroDecision.sceneCrops), вверх — от нижнего бара.
 * Проверено на 1440×900 и 1280×720: остров целиком, здания остановок не под Hero.
 */
export const OVERLAY_FRAMING: Framing = { halfHeight: 66, centerX: -0.3 * 66, centerY: -0.08 * 66 }

/** Рамка 2D-карты на планшете (Figma 34:771, 736×666); на телефоне та же картинка — квадрат по центру. */
export const MAP_ASPECT = 736 / 666
/** Доля ширины рендера, видимая в квадратной карте телефона (object-fit: cover). */
const PHONE_VISIBLE = 1 / MAP_ASPECT
/** Поле моря вокруг острова, доля кадра с каждой стороны. */
const MARGIN = 0.04

type Vec3 = [number, number, number]

function normalize([x, y, z]: Vec3): Vec3 {
  const length = Math.hypot(x, y, z)
  return [x / length, y / length, z / length]
}

function cross([ax, ay, az]: Vec3, [bx, by, bz]: Vec3): Vec3 {
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx]
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

// Оси камеры при повороте 0, как у three Object3D.lookAt(0, 0, 0) с up = +Y.
const axisZ = normalize(cameraPosition(ISO_AZIMUTH_DEG, 1))
const axisX = normalize(cross([0, 1, 0], axisZ))
const axisY = cross(axisZ, axisX)

/** Точка мира → координаты вида (x, y) при повороте карты 0. */
export function toView(point: Vec3): [number, number] {
  return [dot(point, axisX), dot(point, axisY)]
}

export interface Bounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

function boxCorners({ position: [x, y, z], size: [w, h, d] }: Box): Vec3[] {
  const corners: Vec3[] = []
  for (const sx of [-0.5, 0.5])
    for (const sy of [-0.5, 0.5])
      for (const sz of [-0.5, 0.5]) corners.push([x + sx * w, y + sy * h, z + sz * d])
  return corners
}

function bounds(boxes: Box[]): Bounds {
  const points = boxes.flatMap(boxCorners).map(toView)
  return {
    minX: Math.min(...points.map(([x]) => x)),
    maxX: Math.max(...points.map(([x]) => x)),
    minY: Math.min(...points.map(([, y]) => y)),
    maxY: Math.max(...points.map(([, y]) => y)),
  }
}

/** Проекция всего острова: суша, здания остановок, фоновые домики. */
export function islandBounds(): Bounds {
  return bounds([island.land, ...stops.flatMap((stop) => stop.boxes), ...placeHouses(HOUSE_SEED)])
}

/**
 * Кадр рендера острова для 2D-карты: остров по центру с полем MARGIN, соотношение MAP_ASPECT;
 * ширина такая, что остров целиком виден и в квадратной карте телефона.
 */
function islandFraming(): Framing {
  const box = islandBounds()
  const fit = 1 - 2 * MARGIN
  const width = Math.max(
    (box.maxX - box.minX) / (PHONE_VISIBLE * fit),
    ((box.maxY - box.minY) * MAP_ASPECT) / fit,
  )
  return {
    halfHeight: width / MAP_ASPECT / 2,
    centerX: (box.minX + box.maxX) / 2,
    centerY: (box.minY + box.maxY) / 2,
  }
}

export const ISLAND_FRAMING: Framing = islandFraming()

export type MapVariant = 'tablet' | 'phone'

/** Координаты вида → доли рамки 2D-карты (0…1 слева направо и сверху вниз). */
export function toImage([x, y]: [number, number], variant: MapVariant): [number, number] {
  const { halfHeight, centerX, centerY } = ISLAND_FRAMING
  const halfWidth = halfHeight * MAP_ASPECT
  const fx = (x - (centerX - halfWidth)) / (2 * halfWidth)
  const fy = (centerY + halfHeight - y) / (2 * halfHeight)
  if (variant === 'tablet') return [fx, fy]
  return [(fx - (1 - PHONE_VISIBLE) / 2) / PHONE_VISIBLE, fy]
}

export interface MapHotspot {
  id: ChapterId
  /** Проценты рамки карты, округлены до 0.1. */
  left: number
  top: number
  width: number
  height: number
}

const percent = (value: number) => Math.round(value * 1000) / 10

function hotspot(id: ChapterId, boxes: Box[], variant: MapVariant): MapHotspot {
  const box = bounds(boxes)
  const [left, top] = toImage([box.minX, box.maxY], variant)
  const [right, bottom] = toImage([box.maxX, box.minY], variant)
  return {
    id,
    left: percent(left),
    top: percent(top),
    width: percent(right - left),
    height: percent(bottom - top),
  }
}

/** Хотспоты 2D-карты: здания остановок по маршруту, Monitoring — центральная площадь острова. */
export function mapHotspots(): Record<MapVariant, MapHotspot[]> {
  const build = (variant: MapVariant) => [
    ...ROUTE.map(({ id }) => {
      const stop = stops.find((item) => item.id === id)
      if (!stop) throw new Error(`scene: route stop ${id} has no building`)
      return hotspot(id, stop.boxes, variant)
    }),
    hotspot('monitoring', [island.core], variant),
  ]
  return { tablet: build('tablet'), phone: build('phone') }
}
