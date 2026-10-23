import { describe, expect, it } from 'vitest'
import {
  RING,
  TRUCK_SPEED,
  TRUCK_START,
  advance,
  createTruck,
  driveTo,
  isRouteStop,
  parking,
  planRoute,
  type Point,
} from '../useRoute'

// Кольцо в units: NW (−37,−37) → NE (37,−37) → SE (37,37) → SW (−37,37); старт (−37, 0) — западная дорога.
const [nw, ne, se, sw] = RING as [Point, Point, Point, Point]

/** Время в мс, за которое грузовик проезжает `units`. */
const msFor = (units: number) => (units / TRUCK_SPEED) * 1000

function close(actual: Point, expected: Point) {
  expect(actual.x).toBeCloseTo(expected.x, 6)
  expect(actual.z).toBeCloseTo(expected.z, 6)
}

describe('ring and parking', () => {
  it('builds the ring from the four concept waypoints', () => {
    close(nw, { x: -37, z: -37 })
    close(ne, { x: 37, z: -37 })
    close(se, { x: 37, z: 37 })
    close(sw, { x: -37, z: 37 })
    close(TRUCK_START, { x: -37, z: 0 })
  })

  it('parks each stop at the projection of its anchor on the nearest ring segment', () => {
    close(parking('profile'), { x: -24, z: -37 })
    close(parking('timepath'), { x: 37, z: -3.6 })
    close(parking('education'), { x: -25, z: 37 })
    close(parking('contact'), { x: -37, z: -2.5 })
  })

  it('drives only to the six route stops', () => {
    expect(isRouteStop('timepath')).toBe(true)
    expect(isRouteStop('summary')).toBe(false)
    expect(isRouteStop('monitoring')).toBe(false)
  })
})

describe('planRoute', () => {
  it('goes along the shorter arc through the ring corners', () => {
    // Старт → TimePath: на север через NW и NE (37 + 74 + 33.4) короче, чем на юг (37 + 74 + 40.6).
    const route = planRoute(TRUCK_START, 'timepath')

    expect(route).toHaveLength(4)
    close(route[0]!, TRUCK_START)
    close(route[1]!, nw)
    close(route[2]!, ne)
    close(route[3]!, parking('timepath'))
  })

  it('crosses the seam of the ring when that arc is shorter', () => {
    // Education → Profile: через SW и NW, т. е. через «стык» кольца (отрезок SW → NW и затем NW → NE).
    const forward = planRoute(parking('education'), 'profile')

    expect(forward).toHaveLength(4)
    close(forward[1]!, sw)
    close(forward[2]!, nw)
    close(forward[3]!, parking('profile'))

    const backward = planRoute(parking('profile'), 'education')
    close(backward[1]!, nw)
    close(backward[2]!, sw)
  })

  it('goes straight along the segment when the target is on the same road', () => {
    const route = planRoute(TRUCK_START, 'contact')

    expect(route).toHaveLength(2)
    close(route[1]!, parking('contact'))
  })

  it('is empty beyond the start when the truck already stands at the stop', () => {
    expect(planRoute(parking('techstack'), 'techstack')).toHaveLength(1)
  })
})

describe('advance', () => {
  it('moves along the segment at TRUCK_SPEED units per second', () => {
    const truck = driveTo(createTruck(), 'timepath')

    const halfSecond = advance(truck, 500)

    // На север по западной дороге: z уменьшается к −37 (до угла дальше, чем полсекунды пути).
    close(halfSecond.position, { x: -37, z: -TRUCK_SPEED / 2 })
    expect(halfSecond.path).toHaveLength(3)
  })

  it('turns the corner and keeps the leftover distance', () => {
    const truck = driveTo(createTruck(), 'timepath')

    // 37 units до NW, ещё 5 — по северной дороге на восток.
    const moved = advance(truck, msFor(37 + 5))

    close(moved.position, { x: -32, z: -37 })
  })

  it('changes heading on turns (atan2 of the direction in the x/z plane)', () => {
    const truck = driveTo(createTruck(), 'timepath')

    const north = advance(truck, msFor(10))
    const east = advance(truck, msFor(37 + 1))

    expect(north.heading).toBeCloseTo(Math.atan2(-1, 0))
    expect(east.heading).toBeCloseTo(Math.atan2(0, 1))
  })

  it('arrives and stops at the parking point', () => {
    const truck = driveTo(createTruck(), 'contact')

    const done = advance(truck, 10_000)

    close(done.position, parking('contact'))
    expect(done.path).toHaveLength(0)
    expect(advance(done, 1000)).toEqual(done)
  })

  it('re-routes from the current point when a new target comes mid-drive', () => {
    const midway = advance(driveTo(createTruck(), 'timepath'), msFor(12))
    const current = midway.position

    const redirected = driveTo(midway, 'education')

    // Education южнее: разворот с текущей точки (−37, −12) на юг через SW, а не возврат к старту.
    close(redirected.position, current)
    expect(redirected.path).toHaveLength(2)
    close(redirected.path[0]!, sw)
    close(redirected.path[1]!, parking('education'))
    close(advance(redirected, msFor(10)).position, { x: -37, z: current.z + 10 })
  })

  it('teleports to the target when motion is reduced or paused', () => {
    const truck = driveTo(createTruck(), 'timepath')

    const done = advance(truck, 16, { instant: true })

    close(done.position, parking('timepath'))
    expect(done.path).toHaveLength(0)
    // Курс — как у последнего отрезка маршрута (NE → парковка: на юг).
    expect(done.heading).toBeCloseTo(Math.atan2(1, 0))
  })
})
