import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick, ref } from 'vue'
import type { Breakpoint } from '../../shared/lib'
import { useViewMode } from '../useViewMode'

// jsdom без matchMedia: ширину читаем из innerWidth; WebGL2 — подмена getContext.
function mountViewMode(width: number, webgl = true) {
  window.innerWidth = width
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    webgl ? ({} as RenderingContext) : null,
  )
  const breakpoint = ref<Breakpoint>(width >= 768 ? 'desktop' : 'mobile')
  let view!: ReturnType<typeof useViewMode>
  mount(
    defineComponent({
      setup() {
        view = useViewMode(breakpoint)
        return () => h('div')
      },
    }),
  )
  return { view, breakpoint }
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  history.replaceState(null, '', '/')
})

afterEach(() => {
  vi.restoreAllMocks()
  history.replaceState(null, '', '/')
})

describe('useViewMode', () => {
  it('shows 3D for ?mode=3d over a saved 2D choice without remembering it', () => {
    localStorage.setItem('aboutme.sceneChoice', '2d')
    history.replaceState(null, '', '/?mode=3d')

    const { view } = mountViewMode(1440)

    expect(view.store.mode).toBe('3d')
    expect(localStorage.getItem('aboutme.sceneChoice')).toBe('2d')
  })

  it('keeps 2D for ?mode=3d where the scene is impossible', () => {
    history.replaceState(null, '', '/?mode=3d')

    expect(mountViewMode(1440, false).view.store.mode).toBe('2d')
  })

  it('lets the switch button override ?mode= and remembers the choice', () => {
    history.replaceState(null, '', '/?mode=2d')
    const { view, breakpoint } = mountViewMode(1440)
    expect(view.store.mode).toBe('2d')

    view.switchMode()

    expect(view.store.mode).toBe('3d')
    expect(localStorage.getItem('aboutme.sceneChoice')).toBe('3d')
    // ?mode=2d больше не действует: смена ширины пересчитывает режим по выбору.
    breakpoint.value = 'laptop'
    return nextTick().then(() => expect(view.store.mode).toBe('3d'))
  })

  it('switches to 2D on a narrow window and hides the switch on a phone', async () => {
    const { view, breakpoint } = mountViewMode(1440)
    expect(view.store.mode).toBe('3d')
    expect(view.canSwitchMode.value).toBe(true)

    window.innerWidth = 390
    breakpoint.value = 'mobile'
    await nextTick()

    expect(view.store.mode).toBe('2d')
    expect(view.canSwitchMode.value).toBe(false)
  })

  it('does not offer 3D again after the scene failed in this visit', async () => {
    const { view, breakpoint } = mountViewMode(1440)
    view.sceneFailed.value = true
    view.store.sceneTimedOut()

    breakpoint.value = 'laptop'
    await nextTick()

    expect(view.store.mode).toBe('2d')
    expect(view.canSwitchMode.value).toBe(false)
  })
})
