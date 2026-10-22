import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDLE_FALLBACK_MS, loadSceneWhenIdle } from '..'

const component = { name: 'SceneStub' }

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('loadSceneWhenIdle', () => {
  it('imports the scene chunk only after the browser is idle', async () => {
    let idle: (() => void) | undefined
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => {
      idle = cb
      return 1
    })
    const importer = vi.fn(async () => ({ default: component }))

    const pending = loadSceneWhenIdle(importer).promise
    await vi.advanceTimersByTimeAsync(10_000)
    expect(importer).not.toHaveBeenCalled()

    idle?.()
    await expect(pending).resolves.toBe(component)
    expect(importer).toHaveBeenCalledTimes(1)
  })

  it('falls back to a timer where requestIdleCallback is missing (Safari)', async () => {
    vi.stubGlobal('requestIdleCallback', undefined)
    const importer = vi.fn(async () => ({ default: component }))

    const pending = loadSceneWhenIdle(importer).promise
    await vi.advanceTimersByTimeAsync(IDLE_FALLBACK_MS - 1)
    expect(importer).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    await expect(pending).resolves.toBe(component)
  })

  it('never imports once cancelled', async () => {
    vi.stubGlobal('requestIdleCallback', undefined)
    const importer = vi.fn(async () => ({ default: component }))

    const load = loadSceneWhenIdle(importer)
    load.cancel()
    await vi.advanceTimersByTimeAsync(IDLE_FALLBACK_MS * 2)

    expect(importer).not.toHaveBeenCalled()
  })

  it('rejects when the chunk fails to load', async () => {
    vi.stubGlobal('requestIdleCallback', undefined)
    const load = loadSceneWhenIdle(() => Promise.reject(new Error('offline')))
    const outcome = expect(load.promise).rejects.toThrow('offline')

    await vi.advanceTimersByTimeAsync(IDLE_FALLBACK_MS)
    await outcome
  })
})
