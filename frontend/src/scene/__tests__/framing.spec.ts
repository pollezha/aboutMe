import { describe, expect, it } from 'vitest'
import map from '../../../scripts/design/figma-2d-map.json'
import { ROUTE } from '../../content/chapters'
import { ISLAND_RENDER_HEIGHT, ISLAND_RENDER_WIDTH } from '../../fallback2d/render'
import {
  ISLAND_FRAMING,
  MAP_ASPECT,
  OVERLAY_FRAMING,
  islandBounds,
  mapHotspots,
  toImage,
} from '../framing'

describe('scene framing', () => {
  it('keeps the overlay framing of the first screen: island right of the Hero, above the bar', () => {
    expect(OVERLAY_FRAMING).toEqual({ halfHeight: 66, centerX: -0.3 * 66, centerY: -0.08 * 66 })
  })

  it('frames the whole island inside the 2D map render, also in the square phone crop', () => {
    const bounds = islandBounds()
    for (const variant of ['tablet', 'phone'] as const) {
      const topLeft = toImage([bounds.minX, bounds.maxY], variant)
      const bottomRight = toImage([bounds.maxX, bounds.minY], variant)
      expect(topLeft[0]).toBeGreaterThan(0)
      expect(topLeft[1]).toBeGreaterThan(0)
      expect(bottomRight[0]).toBeLessThan(1)
      expect(bottomRight[1]).toBeLessThan(1)
    }
    expect(ISLAND_FRAMING.halfHeight).toBeGreaterThan(0)
  })

  it('renders the map at the tablet map box aspect (Figma 34:771, 736×666)', () => {
    expect(MAP_ASPECT).toBeCloseTo(736 / 666, 6)
    expect(ISLAND_RENDER_WIDTH / ISLAND_RENDER_HEIGHT).toBeCloseTo(MAP_ASPECT, 3)
  })

  it('has one hotspot per route stop and one for Monitoring, in route order', () => {
    const hotspots = mapHotspots()
    for (const variant of ['tablet', 'phone'] as const) {
      expect(hotspots[variant].map((spot) => spot.id)).toEqual([
        ...ROUTE.map((stop) => stop.id),
        'monitoring',
      ])
    }
  })

  // Хотспоты 2D-карты — снимок figma-2d-map.json; рендер острова (npm run island) — из той же сцены.
  // Расхождение > 0.5 % значит, что сцену или кадр поменяли, а JSON — нет.
  it('matches figma-2d-map.json hotspots to the buildings on the island render', () => {
    const projected = mapHotspots()
    for (const variant of ['tablet', 'phone'] as const) {
      for (const spot of projected[variant]) {
        const saved = map.hotspots[variant].find((item) => item.id === spot.id)
        expect(saved, `${variant}/${spot.id}`).toBeDefined()
        for (const key of ['left', 'top', 'width', 'height'] as const) {
          expect(Math.abs(saved![key] - spot[key]), `${variant}/${spot.id}.${key}`).toBeLessThan(
            0.5,
          )
        }
      }
    }
  })
})
