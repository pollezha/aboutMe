import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { loadScene } from '../scene'
import { sceneStub } from '../app/__tests__/sceneStub'
import { mountApp, setViewport, useAppTestEnv } from '../app/__tests__/mountApp'

// three/WebGL в jsdom не рендерим: чанк сцены — заглушка, которая по флагу «рисует первый кадр».
vi.mock('../scene/Scene.vue', () => import('../app/__tests__/sceneStub'))
// Даты в окнах считаются от времени сборки (content/buildTime.ts) — фиксируем его.
vi.mock('../content/buildTime', () => ({ BUILD_TIME: new Date(2026, 9, 23) }))
vi.mock('../scene', async (importOriginal) => {
  const original = await importOriginal<typeof import('../scene')>()
  return { ...original, loadScene: vi.fn(original.loadScene) }
})

useAppTestEnv()

describe('App', () => {
  describe('3D scene loading', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    it('shows a loading card with Continue without 3D outside the hero while the scene loads', async () => {
      const { wrapper, ui } = mountApp()
      await nextTick()

      expect(ui.sceneState).toBe('loading')
      const card = wrapper.get('.scene-loading')
      expect(card.attributes('role')).toBe('status')
      expect(card.text()).toContain('Loading the 3D island')
      expect(card.get('button.btn--secondary').text()).toBe('Continue without 3D')
      expect(wrapper.get('.hero').element.contains(card.element)).toBe(false)
    })

    it('loads the scene chunk only in 3D mode', () => {
      setViewport(390)
      mountApp()

      expect(loadScene).not.toHaveBeenCalled()
    })

    // Контекст WebGL2 дорог (десятки мс при CPU 4×): на телефоне он не нужен — 3D там не бывает (T12b).
    it('does not probe WebGL on a phone', () => {
      setViewport(390)
      const getContext = vi.mocked(HTMLCanvasElement.prototype.getContext)
      getContext.mockClear()
      mountApp()

      expect(getContext).not.toHaveBeenCalled()
    })

    it('marks scene_ready and replaces the placeholder once the first frame is drawn', async () => {
      sceneStub.drawsFirstFrame = true
      const mark = vi.spyOn(performance, 'mark')
      const { wrapper, ui } = mountApp()

      await vi.advanceTimersByTimeAsync(2000)

      expect(loadScene).toHaveBeenCalledTimes(1)
      expect(mark).toHaveBeenCalledWith('scene_ready')
      expect(ui.sceneState).toBe('ready')
      expect(wrapper.find('.scene-stub').exists()).toBe(true)
      expect(wrapper.find('.scene-loading').exists()).toBe(false)

      await vi.advanceTimersByTimeAsync(10_000)
      expect(ui.mode).toBe('3d')
    })

    it('falls back to the 2D map with a dismissible banner when the scene is not ready in 8 s', async () => {
      const { wrapper, ui } = mountApp()

      await vi.advanceTimersByTimeAsync(7999)
      expect(ui.mode).toBe('3d')

      await vi.advanceTimersByTimeAsync(1)
      expect(ui.mode).toBe('2d')
      expect(wrapper.find('.scene-loading').exists()).toBe(false)
      expect(wrapper.find('.scene-stub').exists()).toBe(false)
      expect(wrapper.findAll('.static-map button.hotspot')).toHaveLength(7)
      const banner = wrapper.get('.scene-banner')
      expect(banner.attributes('role')).toBe('status')
      expect(banner.text()).toContain("3D scene didn't load — showing the map")
      expect(localStorage.getItem('aboutme.sceneChoice')).toBeNull()

      await banner.get('button[aria-label="Dismiss"]').trigger('click')
      expect(wrapper.find('.scene-banner').exists()).toBe(false)
    })

    it('remembers Continue without 3D and starts in 2D on the next visit', async () => {
      const first = mountApp()
      await nextTick()

      await first.wrapper.get('.scene-loading button').trigger('click')

      expect(first.ui.mode).toBe('2d')
      expect(first.wrapper.find('.scene-loading').exists()).toBe(false)
      expect(localStorage.getItem('aboutme.sceneChoice')).toBe('2d')
      await vi.advanceTimersByTimeAsync(10_000)
      expect(first.wrapper.find('.scene-banner').exists()).toBe(false)
      first.wrapper.unmount()
      vi.mocked(loadScene).mockClear()

      const next = mountApp()

      expect(next.ui.mode).toBe('2d')
      expect(loadScene).not.toHaveBeenCalled()
    })
  })
})
