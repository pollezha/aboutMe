import { describe, expect, it } from 'vitest'
import { ISLAND_SIZE, island, roads, stops, toBox } from '../layout'

describe('scene layout', () => {
  it('centres the 1100 px concept plane on the origin at 10 px per unit', () => {
    expect(ISLAND_SIZE).toBe(110)
    expect(island.land.position[0]).toBe(0)
    expect(island.land.position[2]).toBe(0)
    expect(island.land.size[0]).toBe(110)
  })

  it('keeps the plate, core and roads flat: their concept "h" is depth, not height', () => {
    expect(island.plate.size).toEqual([64, expect.any(Number), 64])
    expect(island.core.size).toEqual([22, expect.any(Number), 22])
    for (const box of [island.plate, island.core, ...roads]) {
      expect(box.size[1]).toBeLessThan(1)
    }
  })

  it('maps concept x to +X, y to +Z and height to +Y from the base', () => {
    expect(toBox({ x: 0, y: 1000, w: 100, d: 100, h: 200 }, 1)).toEqual({
      position: [-50, 11, 50],
      size: [10, 20, 10],
    })
  })

  it('has four ring roads and a stub building for each of the six stops', () => {
    expect(roads).toHaveLength(4)
    expect(stops.map((stop) => stop.id)).toEqual([
      'profile',
      'prospace',
      'timepath',
      'techstack',
      'education',
      'contact',
    ])
    for (const stop of stops) expect(stop.building.size[1]).toBeGreaterThan(0)
  })
})
