import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, effectScope, h, nextTick, type Component } from 'vue'
import { useModeStore } from '../useModeStore'
import { useSceneLoader } from '../useSceneLoader'

const SceneComponent = defineComponent({ render: () => h('div') })

type Importer = () => Promise<{ default: Component }>

// По умолчанию чанк «качается» бесконечно: ready не придёт, пока спек его не вызовет.
function setup(importer = vi.fn<Importer>(() => new Promise(() => {}))) {
  const scope = effectScope()
  const loader = scope.run(() => useSceneLoader({ importer }))!
  return { loader, importer, store: useModeStore(), scope }
}

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useSceneLoader', () => {
  it('falls back to 2D with a failed state when the scene is not ready in 8 s', async () => {
    const { loader, store } = setup()

    loader.start()
    expect(store.sceneState).toBe('loading')

    await vi.advanceTimersByTimeAsync(7999)
    expect(store.mode).toBe('3d')

    await vi.advanceTimersByTimeAsync(1)
    expect(store.sceneState).toBe('failed')
    expect(store.mode).toBe('2d')
    expect(store.sceneFailed).toBe(true)
    expect(localStorage.getItem('aboutme.sceneChoice')).toBeNull()
  })

  it('does not import the scene twice when start is called again while loading', async () => {
    const { loader, importer } = setup()

    loader.start()
    loader.start()
    await vi.advanceTimersByTimeAsync(100)
    loader.start()
    await vi.advanceTimersByTimeAsync(100)

    expect(importer).toHaveBeenCalledTimes(1)
  })

  it('marks scene_ready and keeps 3D once the first frame is drawn', async () => {
    const mark = vi.spyOn(performance, 'mark')
    const { loader, store } = setup(vi.fn<Importer>(async () => ({ default: SceneComponent })))

    loader.start()
    await vi.advanceTimersByTimeAsync(10)
    expect(loader.component.value).toBe(SceneComponent)

    loader.ready()
    await vi.advanceTimersByTimeAsync(10_000)

    expect(mark).toHaveBeenCalledWith('scene_ready')
    expect(store.sceneState).toBe('ready')
    expect(store.mode).toBe('3d')
  })

  it('falls back to 2D when the scene chunk fails to load', async () => {
    const { loader, store } = setup(vi.fn<Importer>(() => Promise.reject(new Error('chunk'))))

    loader.start()
    await vi.advanceTimersByTimeAsync(10)

    expect(store.sceneState).toBe('failed')
    expect(store.mode).toBe('2d')
  })

  it('cancels loading and remembers 2D on Continue without 3D', async () => {
    const { loader, store, importer } = setup()

    loader.start()
    loader.continueWithout3D()
    await vi.advanceTimersByTimeAsync(10_000)

    expect(importer).not.toHaveBeenCalled()
    expect(store.mode).toBe('2d')
    expect(store.sceneState).toBe('idle')
    expect(localStorage.getItem('aboutme.sceneChoice')).toBe('2d')
  })

  it('starts only in 3D and stops loading when the mode switches to 2D', async () => {
    const { loader, store, importer } = setup()
    store.setMode('2d')
    await nextTick()
    loader.start()
    expect(store.sceneState).toBe('idle')

    store.setMode('3d')
    await nextTick()
    expect(store.sceneState).toBe('loading')

    store.setMode('2d')
    await nextTick()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(store.sceneState).toBe('idle')
    expect(importer).not.toHaveBeenCalled()
  })

  it('stops loading when its scope is disposed', async () => {
    const { loader, store, importer, scope } = setup()

    loader.start()
    scope.stop()
    await vi.advanceTimersByTimeAsync(10_000)

    expect(importer).not.toHaveBeenCalled()
    expect(store.mode).toBe('3d')
  })
})
