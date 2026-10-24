import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadScene } from '..'

const component = { name: 'SceneStub' }

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('loadScene', () => {
  it('imports the scene chunk right after the current task, without waiting for idle', async () => {
    const idle = vi.fn()
    vi.stubGlobal('requestIdleCallback', idle)
    const importer = vi.fn(async () => ({ default: component }))

    const pending = loadScene(importer).promise
    expect(importer).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(0)
    expect(importer).toHaveBeenCalledTimes(1)
    expect(idle).not.toHaveBeenCalled()
    await expect(pending).resolves.toBe(component)
  })

  it('never imports once cancelled', async () => {
    const importer = vi.fn(async () => ({ default: component }))

    const load = loadScene(importer)
    load.cancel()
    await vi.advanceTimersByTimeAsync(1000)

    expect(importer).not.toHaveBeenCalled()
  })

  it('rejects when the chunk fails to load', async () => {
    const load = loadScene(() => Promise.reject(new Error('offline')))
    const outcome = expect(load.promise).rejects.toThrow('offline')

    await vi.advanceTimersByTimeAsync(0)
    await outcome
  })
})
