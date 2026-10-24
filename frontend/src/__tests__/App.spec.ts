import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { loadScene } from '../scene'
import { mapRotation } from '../scene/useCamera'
import { sceneStub } from '../app/__tests__/sceneStub'
import {
  mountApp,
  openDialog,
  setViewport,
  useAppTestEnv,
  waitForHash,
} from '../app/__tests__/mountApp'

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
  it('opens the ProSpace window right after a click on stop 02', async () => {
    const { wrapper, ui } = mountApp()

    await wrapper.findAll('.route-stop')[1]!.trigger('click')

    const dialog = openDialog(wrapper)
    expect(dialog.exists()).toBe(true)
    expect(dialog.get('h2').text()).toBe('ProSpace · OptiTrack')
    expect(dialog.get('.window__eyebrow').text()).toMatch(/^Stop 2 of 6 · Waybill · Latest role · /)
    expect(ui.activeStop).toBe('prospace')
    expect(wrapper.findAll('.route-stop')[1]!.attributes('aria-current')).toBe('step')
    expect(location.hash).toBe('#prospace')
  })

  it('walks the route with next/prev and has no prev on 01 and no next on 06', async () => {
    const { wrapper, ui } = mountApp()

    ui.openChapter('profile')
    await nextTick()
    expect(openDialog(wrapper).text()).not.toContain('←')
    await openDialog(wrapper).get('.window__nav button').trigger('click')
    expect(ui.openWindow).toBe('prospace')

    ui.openChapter('contact')
    await nextTick()
    const nav = openDialog(wrapper).findAll('.window__nav button')
    expect(nav).toHaveLength(1)
    expect(nav[0]!.text()).toContain('05')
  })

  it('shows only Close in the Monitoring window', async () => {
    const { wrapper } = mountApp()

    await wrapper.get('.bottom-bar__actions .btn--ghost').trigger('click')

    const dialog = openDialog(wrapper)
    expect(dialog.get('h2').text()).toBe('Monitoring')
    expect(dialog.find('.window__nav').exists()).toBe(false)
  })

  it('closing the window clears the hash', async () => {
    const { wrapper, ui } = mountApp()
    ui.openChapter('prospace')
    await nextTick()

    await openDialog(wrapper).get('button[aria-label="Close"]').trigger('click')
    await waitForHash('')

    expect(ui.openWindow).toBeNull()
    expect(location.hash).toBe('')
  })

  it('pushes a history entry when a window opens and closes it on Back', async () => {
    const { wrapper, ui } = mountApp()

    await wrapper.findAll('.route-stop')[1]!.trigger('click')
    expect(history.state?.chapter).toBe('prospace')
    expect(location.hash).toBe('#prospace')

    history.back()
    await waitForHash('')
    window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }))
    await nextTick()

    expect(ui.openWindow).toBeNull()
    expect(openDialog(wrapper).exists()).toBe(false)
  })

  it('replaces the history entry on prev/next instead of stacking one per chapter', async () => {
    const { wrapper } = mountApp()
    await wrapper.findAll('.route-stop')[1]!.trigger('click')
    const length = history.length

    await openDialog(wrapper).get('.window__nav .btn--secondary').trigger('click')

    expect(location.hash).toBe('#timepath')
    expect(history.state?.chapter).toBe('timepath')
    expect(history.length).toBe(length)
  })

  it('closes the window when the hash is cleared', async () => {
    const { wrapper, ui } = mountApp()
    ui.openChapter('contact')
    await nextTick()

    location.hash = ''
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await nextTick()

    expect(ui.openWindow).toBeNull()
    expect(openDialog(wrapper).exists()).toBe(false)
  })

  it('closes a deep-linked window without leaving the page', async () => {
    history.replaceState(null, '', '/#contact')
    const { wrapper, ui } = mountApp()
    await flushPromises()
    const length = history.length

    await openDialog(wrapper).get('button[aria-label="Close"]').trigger('click')

    expect(ui.openWindow).toBeNull()
    expect(location.hash).toBe('')
    expect(history.length).toBe(length)
  })

  it('moves focus to the new title on next (05 → 06) and on prev (02 → 01)', async () => {
    const { wrapper, ui } = mountApp()

    ui.openChapter('education')
    await nextTick()
    await openDialog(wrapper).get('.window__nav .btn--secondary').trigger('click')
    await flushPromises()
    expect(document.activeElement?.tagName).toBe('H2')
    expect(document.activeElement?.textContent).toBe('Next stop: your team.')

    ui.openChapter('prospace')
    await flushPromises()
    await openDialog(wrapper).get('.window__nav .btn--ghost').trigger('click')
    await flushPromises()
    expect(document.activeElement?.tagName).toBe('H2')
    expect(document.activeElement?.textContent).toBe('Yakov Polezhaev')
    expect(openDialog(wrapper).text()).not.toContain('←')
  })

  it('switches to the 2D map on a phone and opens a chapter from a hotspot', async () => {
    setViewport(390)
    const { wrapper, ui } = mountApp()

    expect(ui.mode).toBe('2d')
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
      const { wrapper, ui } = mountApp()

      expect(ui.mode).toBe('2d')
      expect(wrapper.findAll('.static-map button.hotspot')).toHaveLength(7)
      expect(loadScene).not.toHaveBeenCalled()
      expect(localStorage.getItem('aboutme.sceneChoice')).toBeNull()
    })

    it('lets ?mode=3d override a saved 2D choice for this visit only', () => {
      localStorage.setItem('aboutme.sceneChoice', '2d')
      history.replaceState(null, '', '/?mode=3d')
      const { ui } = mountApp()

      expect(ui.mode).toBe('3d')
      expect(localStorage.getItem('aboutme.sceneChoice')).toBe('2d')
    })

    it('does not force 3D with ?mode=3d where 3D is unavailable', () => {
      setViewport(390)
      history.replaceState(null, '', '/?mode=3d')
      const { ui } = mountApp()

      expect(ui.mode).toBe('2d')
    })

    it('switches 3D → 2D → 3D from the top controls and remembers the choice', async () => {
      const { wrapper, ui } = mountApp()
      expect(ui.mode).toBe('3d')

      await wrapper.get('.top-bar button[aria-label="Switch to 2D"]').trigger('click')

      expect(ui.mode).toBe('2d')
      expect(localStorage.getItem('aboutme.sceneChoice')).toBe('2d')
      expect(wrapper.find('.static-map').exists()).toBe(true)

      await wrapper.get('.top-bar button[aria-label="Switch to 3D"]').trigger('click')

      expect(ui.mode).toBe('3d')
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
      expect(noGl.ui.mode).toBe('2d')
      expect(noGl.wrapper.find('.top-bar__mode').exists()).toBe(false)
    })
  })

  it('shows only the scene for the island render (?shot=island)', () => {
    history.replaceState(null, '', '/?mode=3d&theme=night&shot=island')
    const { wrapper, ui } = mountApp()

    expect(ui.mode).toBe('3d')
    for (const selector of [
      '.top-bar',
      '.hero',
      '.bottom-bar',
      '.scene-loading',
      '.scene-placeholder',
    ])
      expect(wrapper.find(selector).exists(), selector).toBe(false)
    expect(wrapper.get('.app').classes()).toContain('app--shot')
  })

  it('decides 2D by the same media query as CSS, not by innerWidth', () => {
    setViewport(1440)
    const matchMedia = window.matchMedia
    window.matchMedia = ((query: string) => ({
      ...matchMedia(query),
      matches: query.includes('min-width: 768px') ? false : matchMedia(query).matches,
    })) as typeof window.matchMedia

    const { ui } = mountApp()

    expect(ui.mode).toBe('2d')
  })

  it('falls back to 2D on a wide screen without WebGL2', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const { wrapper, ui } = mountApp()

    expect(ui.mode).toBe('2d')
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
    const { wrapper, ui } = mountApp()

    expect(ui.mode).toBe('2d')
    expect(wrapper.find('.top-bar__rotate').exists()).toBe(false)
  })

  it('opens the Contact window from the #contact deep link', async () => {
    history.replaceState(null, '', '/#contact')

    const { wrapper } = mountApp()
    await flushPromises()

    expect(openDialog(wrapper).get('h2').text()).toBe('Next stop: your team.')
  })

  it('opens the ProSpace window with its body, dates and proof links from the #prospace deep link', async () => {
    history.replaceState(null, '', '/#prospace')

    const { wrapper } = mountApp()
    await flushPromises()

    const dialog = openDialog(wrapper)
    expect(dialog.get('.window__eyebrow').text()).toBe(
      'Stop 2 of 6 · Waybill · Latest role · Jan – Oct 2026',
    )
    expect(dialog.get('.window__eyebrow .icon').attributes('aria-hidden')).toBe('true')
    expect(dialog.get('.window__subtitle').text()).toBe(
      'Backend Developer (.NET) · TMS for large cargo owners',
    )
    expect(dialog.findAll('.key-results > li')).toHaveLength(5)
    const proof = dialog.get('.window__links a')
    expect(proof.text()).toBe('prospace.tech')
    expect(proof.attributes('href')).toBe('https://prospace.tech')
  })

  it('shows windows outside the route without a Stop prefix', async () => {
    history.replaceState(null, '', '/#monitoring')

    const { wrapper } = mountApp()
    await flushPromises()

    expect(openDialog(wrapper).get('.window__eyebrow').text()).toBe('Monitoring · this site, live')
  })

  it('ignores an unknown hash', async () => {
    history.replaceState(null, '', '/#nope')

    const { wrapper } = mountApp()
    await flushPromises()

    expect(openDialog(wrapper).exists()).toBe(false)
  })

  it('toggles motion pause from the top bar', async () => {
    const { wrapper, ui } = mountApp()

    const pause = wrapper.get('.top-bar button[aria-label="Pause animation"]')
    expect(pause.attributes('aria-pressed')).toBe('false')
    await pause.trigger('click')

    expect(ui.motionPaused).toBe(true)
    expect(pause.attributes('aria-pressed')).toBe('true')
  })

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
