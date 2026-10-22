import { describe, expect, it } from 'vitest'
import { island, roads, stops, type Box } from '../layout'
import { HOUSE_SEED, placeHouses } from '../buildings/houses'

type Rect = { minX: number; maxX: number; minZ: number; maxZ: number }

function footprint({ position: [x, , z], size: [w, , d] }: Box): Rect {
  return { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 }
}

function overlaps(a: Rect, b: Rect) {
  return a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ
}

function inside(inner: Rect, outer: Rect) {
  return (
    inner.minX >= outer.minX &&
    inner.maxX <= outer.maxX &&
    inner.minZ >= outer.minZ &&
    inner.maxZ <= outer.maxZ
  )
}

describe('placeHouses', () => {
  const houses = placeHouses(HOUSE_SEED)

  it('places 20–40 background houses', () => {
    expect(houses.length).toBeGreaterThanOrEqual(20)
    expect(houses.length).toBeLessThanOrEqual(40)
  })

  it('is deterministic for a seed', () => {
    expect(placeHouses(HOUSE_SEED)).toEqual(houses)
    expect(placeHouses(HOUSE_SEED + 1)).not.toEqual(houses)
  })

  it('keeps houses on the plate, off the core, roads, stop pads and each other', () => {
    const plate = footprint(island.plate)
    const blocked = [island.core, ...roads, ...stops.map((stop) => stop.pad)].map(footprint)

    houses.forEach((house, i) => {
      const rect = footprint(house)
      expect(inside(rect, plate), `house ${i} on the plate`).toBe(true)
      for (const zone of blocked) expect(overlaps(rect, zone), `house ${i}`).toBe(false)
      houses.slice(i + 1).forEach((other, j) => {
        expect(overlaps(rect, footprint(other)), `houses ${i} and ${i + j + 1}`).toBe(false)
      })
      expect(house.size[1]).toBeGreaterThan(0)
    })
  })
})
