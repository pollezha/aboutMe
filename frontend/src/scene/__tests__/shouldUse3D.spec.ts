import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectWebGL2, shouldUse3D } from '../shouldUse3D'

const capable = { width: 1440, webgl: true, deviceMemory: 8, userChoice: null } as const

afterEach(() => {
  vi.restoreAllMocks()
})

describe('shouldUse3D', () => {
  it('uses 3D on a wide screen with WebGL2 and enough memory', () => {
    expect(shouldUse3D(capable)).toBe(true)
  })

  it('uses 2D below 768 px', () => {
    expect(shouldUse3D({ ...capable, width: 767 })).toBe(false)
    expect(shouldUse3D({ ...capable, width: 768 })).toBe(true)
  })

  it('uses 2D without WebGL2', () => {
    expect(shouldUse3D({ ...capable, webgl: false })).toBe(false)
  })

  it('uses 2D with less than 4 GB of device memory', () => {
    expect(shouldUse3D({ ...capable, deviceMemory: 2 })).toBe(false)
    expect(shouldUse3D({ ...capable, deviceMemory: 4 })).toBe(true)
  })

  it('ignores unknown device memory', () => {
    expect(shouldUse3D({ ...capable, deviceMemory: undefined })).toBe(true)
  })

  it('respects the user choosing 2D', () => {
    expect(shouldUse3D({ ...capable, userChoice: '2d' })).toBe(false)
    expect(shouldUse3D({ ...capable, userChoice: '3d' })).toBe(true)
  })
})

describe('detectWebGL2', () => {
  it('is true when a webgl2 context can be created', () => {
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({} as RenderingContext)

    expect(detectWebGL2()).toBe(true)
    expect(getContext).toHaveBeenCalledWith('webgl2')
  })

  it('is false when the context is unavailable', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)

    expect(detectWebGL2()).toBe(false)
  })

  it('is false when creating the context throws', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(detectWebGL2()).toBe(false)
  })
})
