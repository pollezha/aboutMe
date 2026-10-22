import { describe, expect, it } from 'vitest'
import {
  ISO_AZIMUTH_DEG,
  ROTATE_DURATION_MS,
  cameraPosition,
  createMapRotation,
  isRotateHotkey,
  useCamera,
} from '../useCamera'

const DISTANCE = 200 * Math.sqrt(3)

function expectClose(actual: readonly number[], expected: readonly number[]) {
  actual.forEach((value, i) => expect(value).toBeCloseTo(expected[i]!, 6))
}

describe('map rotation', () => {
  it('turns by a quarter in both directions and wraps around', () => {
    const map = createMapRotation()
    expect(map.rotation.value).toBe(0)

    map.rotate()
    expect(map.rotation.value).toBe(90)
    map.rotate()
    map.rotate()
    map.rotate()
    expect(map.rotation.value).toBe(0)

    map.rotate(-1)
    expect(map.rotation.value).toBe(270)
  })
})

describe('cameraPosition', () => {
  it('keeps the current isometric view at rotation 0 and orbits the centre at the same height', () => {
    expectClose(cameraPosition(ISO_AZIMUTH_DEG, DISTANCE), [200, 200, 200])
    expectClose(cameraPosition(ISO_AZIMUTH_DEG + 90, DISTANCE), [200, 200, -200])
    expectClose(cameraPosition(ISO_AZIMUTH_DEG + 180, DISTANCE), [-200, 200, -200])
  })
})

describe('useCamera', () => {
  it('animates a quarter turn over 300 ms', () => {
    const map = createMapRotation()
    const camera = useCamera({ map, distance: DISTANCE, instant: () => false })
    expectClose(camera.position(), [200, 200, 200])

    camera.rotate()
    camera.step(ROTATE_DURATION_MS / 2)
    const halfway = camera.azimuth()
    expect(halfway).toBeGreaterThan(ISO_AZIMUTH_DEG)
    expect(halfway).toBeLessThan(ISO_AZIMUTH_DEG + 90)

    camera.step(ROTATE_DURATION_MS / 2)
    expect(camera.azimuth()).toBeCloseTo(ISO_AZIMUTH_DEG + 90, 6)
    expectClose(camera.position(), [200, 200, -200])
    expect(camera.rotation.value).toBe(90)
  })

  it('jumps to the target at once with reduced motion or paused animation', () => {
    const map = createMapRotation()
    const camera = useCamera({ map, distance: DISTANCE, instant: () => true })

    camera.rotate()
    camera.step(0)

    expect(camera.azimuth()).toBeCloseTo(ISO_AZIMUTH_DEG + 90, 6)
  })

  it('keeps turning the same way past 270° instead of spinning back', () => {
    const map = createMapRotation()
    const camera = useCamera({ map, distance: DISTANCE, instant: () => true })
    for (let i = 0; i < 3; i++) {
      camera.rotate()
      camera.step(0)
    }
    const before = camera.azimuth()

    camera.rotate()
    camera.step(0)

    expect(map.rotation.value).toBe(0)
    expect(camera.azimuth()).toBeCloseTo(before + 90, 6)
  })

  it('follows rotations made elsewhere (the button in the HTML layer)', () => {
    const map = createMapRotation()
    const camera = useCamera({ map, distance: DISTANCE, instant: () => true })

    map.rotate(-1)
    camera.step(16)

    expect(camera.azimuth()).toBeCloseTo(ISO_AZIMUTH_DEG - 90, 6)
  })
})

describe('isRotateHotkey', () => {
  function key(init: KeyboardEventInit, target: Element = document.body) {
    const event = new KeyboardEvent('keydown', init)
    Object.defineProperty(event, 'target', { value: target })
    return event
  }

  it('accepts R and r on the page', () => {
    expect(isRotateHotkey(key({ key: 'r' }), false)).toBe(true)
    expect(isRotateHotkey(key({ key: 'R' }), false)).toBe(true)
  })

  it('ignores R typed into fields', () => {
    for (const tag of ['input', 'textarea', 'select']) {
      expect(isRotateHotkey(key({ key: 'r' }, document.createElement(tag)), false)).toBe(false)
    }
    const editable = document.createElement('div')
    editable.contentEditable = 'true'
    expect(isRotateHotkey(key({ key: 'r' }, editable), false)).toBe(false)
  })

  it('ignores R while a chapter window is open and with modifiers (Ctrl+R reloads)', () => {
    expect(isRotateHotkey(key({ key: 'r' }), true)).toBe(false)
    expect(isRotateHotkey(key({ key: 'r', ctrlKey: true }), false)).toBe(false)
    expect(isRotateHotkey(key({ key: 'r', metaKey: true }), false)).toBe(false)
    expect(isRotateHotkey(key({ key: 'r', altKey: true }), false)).toBe(false)
  })
})
