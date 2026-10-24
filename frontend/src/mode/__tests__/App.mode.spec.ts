import { describe, expect, it, vi } from 'vitest'
import { loadScene } from '../../scene'
import { mapRotation } from '../../scene/useCamera'
import { mountApp, openDialog, setViewport, useAppTestEnv } from '../../app/__tests__/mountApp'

// three/WebGL в jsdom не рендерим: чанк сцены — заглушка, которая по флагу «рисует первый кадр».
vi.mock('../../scene/Scene.vue', () => import('../../app/__tests__/sceneStub'))
// Даты в окнах считаются от времени сборки (content/buildTime.ts) — фиксируем его.
vi.mock('../../content/buildTime', () => ({ BUILD_TIME: new Date(2026, 9, 23) }))
vi.mock('../../scene', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../scene')>()
  return { ...original, loadScene: vi.fn(original.loadScene) }
})

useAppTestEnv()

describe('App', () => {
  it('switches to the 2D map on a phone and opens a chapter from a hotspot', async () => {
    setViewport(390)
    const { wrapper, mode } = mountApp()

    expect(mode.mode).toBe('2d')
    expect(wrapper.find('.scene-placeholder').exists()).toBe(false)
    const hotspots = wrapper.findAll('.static-map button.hotspot')
    expect(hotspots).toHaveLength(7)
    expect(wrapper.find('.hero--mobile').exists()).toBe(true)

    await wrapper.get('button[aria-label="03 TimePath · Previous role"]').trigger('click')

    expect(openDialog(wrapper).get('h2').text()).toBe('TimePath')
  })

  describe('explicit 2D/3D choice', () => {
    it('lets ?mode=2d override the detector with WebGL available, without remembering it', () => {
      history.replaceState(null, '', '/?mode=2d')
      const { wrapper, mode } = mountApp()

      expect(mode.mode).toBe('2d')
      expect(wrapper.findAll('.static-map button.hotspot')).toHaveLength(7)
      expect(loadScene).not.toHaveBeenCalled()
      expect(localStorage.getItem('aboutme.sceneChoice')).toBeNull()
    })

    it('lets ?mode=3d override a saved 2D choice for this visit only', () => {
      localStorage.setItem('aboutme.sceneChoice', '2d')
      history.replaceState(null, '', '/?mode=3d')
      const { mode } = mountApp()

      expect(mode.mode).toBe('3d')
      expect(localStorage.getItem('aboutme.sceneChoice')).toBe('2d')
    })

    it('does not force 3D with ?mode=3d where 3D is unavailable', () => {
      setViewport(390)
      history.replaceState(null, '', '/?mode=3d')
      const { mode } = mountApp()

      expect(mode.mode).toBe('2d')
    })

    it('switches 3D → 2D → 3D from the top controls and remembers the choice', async () => {
      const { wrapper, mode } = mountApp()
      expect(mode.mode).toBe('3d')

      await wrapper.get('.top-bar button[aria-label="Switch to 2D"]').trigger('click')

      expect(mode.mode).toBe('2d')
      expect(localStorage.getItem('aboutme.sceneChoice')).toBe('2d')
      expect(wrapper.find('.static-map').exists()).toBe(true)

      await wrapper.get('.top-bar button[aria-label="Switch to 3D"]').trigger('click')

      expect(mode.mode).toBe('3d')
      expect(localStorage.getItem('aboutme.sceneChoice')).toBe('3d')
      expect(wrapper.find('.static-map').exists()).toBe(false)
    })

    it('offers no 3D switch on a phone or without WebGL2', () => {
      setViewport(390)
      const phone = mountApp()
      expect(phone.wrapper.find('.top-bar__mode').exists()).toBe(false)
      phone.wrapper.unmount()

      setViewport(1440)
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
      const noGl = mountApp()
      expect(noGl.mode.mode).toBe('2d')
      expect(noGl.wrapper.find('.top-bar__mode').exists()).toBe(false)
    })
  })

  it('decides 2D by the same media query as CSS, not by innerWidth', () => {
    setViewport(1440)
    const matchMedia = window.matchMedia
    window.matchMedia = ((query: string) => ({
      ...matchMedia(query),
      matches: query.includes('min-width: 768px') ? false : matchMedia(query).matches,
    })) as typeof window.matchMedia

    const { mode } = mountApp()

    expect(mode.mode).toBe('2d')
  })

  it('falls back to 2D on a wide screen without WebGL2', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const { wrapper, mode } = mountApp()

    expect(mode.mode).toBe('2d')
    expect(wrapper.findAll('.static-map button.hotspot')).toHaveLength(7)
  })

  it('rotates the map a quarter turn from the top controls in 3D', async () => {
    const { wrapper } = mountApp()
    const before = mapRotation.rotation.value

    const rotate = wrapper.get('.top-bar__rotate')
    expect(rotate.attributes('aria-label')).toBe('Rotate map')
    expect(rotate.attributes('title')).toBe('Rotate map · R')
    expect(rotate.attributes('disabled')).toBeUndefined()
    await rotate.trigger('click')

    expect(mapRotation.rotation.value).toBe((before + 90) % 360)
  })

  it('has no rotate button in 2D', () => {
    setViewport(390)
    const { wrapper, mode } = mountApp()

    expect(mode.mode).toBe('2d')
    expect(wrapper.find('.top-bar__rotate').exists()).toBe(false)
  })

  it('toggles motion pause from the top bar', async () => {
    const { wrapper, route } = mountApp()

    const pause = wrapper.get('.top-bar button[aria-label="Pause animation"]')
    expect(pause.attributes('aria-pressed')).toBe('false')
    await pause.trigger('click')

    expect(route.motionPaused).toBe(true)
    expect(pause.attributes('aria-pressed')).toBe('true')
  })
})
