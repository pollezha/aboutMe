import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick, onMounted } from 'vue'
import App from '../App.vue'
import { appPlugins } from './appPlugins'
import { contentFor } from '../content/bundles'
import { loadSceneWhenIdle } from '../scene'
import { mapRotation } from '../scene/useCamera'
import { useUiStore } from '../stores/ui'

// three/WebGL в jsdom не рендерим: чанк сцены — заглушка, которая по флагу «рисует первый кадр».
const sceneStub = vi.hoisted(() => ({ drawsFirstFrame: false }))
vi.mock('../scene/Scene.vue', () => ({
  default: defineComponent({
    emits: ['ready'],
    setup(_, { emit }) {
      onMounted(() => {
        if (sceneStub.drawsFirstFrame) emit('ready')
      })
      return () => h('div', { class: 'scene-stub' })
    },
  }),
}))
// Даты в окнах считаются от времени сборки (content/buildTime.ts) — фиксируем его.
vi.mock('../content/buildTime', () => ({ BUILD_TIME: new Date(2026, 9, 23) }))
vi.mock('../scene', async (importOriginal) => {
  const original = await importOriginal<typeof import('../scene')>()
  return { ...original, loadSceneWhenIdle: vi.fn(original.loadSceneWhenIdle) }
})

const ruContent = contentFor('ru')

// jsdom: нет matchMedia, WebGL и showModal() — минимальные подмены.
function setViewport(width: number) {
  window.innerWidth = width
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query)
    const max = /max-width:\s*(\d+)px/.exec(query)
    const matches =
      (!min || width >= Number(min[1])) && (!max || width <= Number(max[1])) && (!!min || !!max)
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    } as MediaQueryList
  }) as typeof window.matchMedia
}

const dialogProto = HTMLDialogElement.prototype
const originalDialog = { showModal: dialogProto.showModal, close: dialogProto.close }

let wrapper: VueWrapper | undefined

beforeEach(() => {
  localStorage.clear()
  history.replaceState(null, '', '/')
  setViewport(1440)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as RenderingContext)
  dialogProto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  dialogProto.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.restoreAllMocks()
  vi.mocked(loadSceneWhenIdle).mockClear()
  vi.useRealTimers()
  sceneStub.drawsFirstFrame = false
  dialogProto.showModal = originalDialog.showModal
  dialogProto.close = originalDialog.close
})

function mountApp() {
  const pinia = createPinia()
  setActivePinia(pinia)
  wrapper = mount(App, { global: { plugins: appPlugins(pinia) }, attachTo: document.body })
  return { wrapper, ui: useUiStore() }
}

/** unhead пишет `<html lang>` в DOM не синхронно — ждём условие. */
async function waitFor(condition: () => boolean) {
  for (let i = 0; i < 50 && !condition(); i++) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

/** jsdom выполняет history.back() асинхронно. */
async function waitForHash(hash: string) {
  for (let i = 0; i < 50 && location.hash !== hash; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

function openDialog(w: VueWrapper) {
  return w.find('dialog[open]')
}

describe('App', () => {
  it('shows name and role in English by default', () => {
    const { wrapper } = mountApp()

    const hero = wrapper.get('.hero')
    expect(hero.get('h1').text()).toBe('Yakov Polezhaev')
    expect(hero.text()).toContain('.NET Backend Developer')
  })

  it('switches the hero to Russian after ui.setLang("ru")', async () => {
    const { wrapper, ui } = mountApp()

    ui.setLang('ru')
    await nextTick()

    const hero = wrapper.get('.hero')
    expect(hero.text()).toContain('Яков Полежаев')
    expect(hero.text()).toContain('.NET backend-разработчик')
    expect(hero.text()).not.toContain('Yakov Polezhaev')
  })

  // TC-06: /ru/ — весь первый экран и окна на русском, из RU-бандла.
  it('renders the hero, the bar and windows from the Russian bundle on /ru/', async () => {
    history.replaceState(null, '', '/ru/#prospace')
    const { wrapper } = mountApp()
    await flushPromises()

    const hero = wrapper.get('.hero')
    expect(hero.text()).toContain(ruContent.profile.status)
    expect(hero.text()).toContain(ruContent.profile.workFormat)
    expect(hero.text()).toContain('Связаться')
    expect(hero.get('a.btn--secondary').attributes('href')).toBe('/cv/Yakov_Polezhaev_CV_RU.pdf')
    expect(hero.get('a.btn--secondary').text()).toBe('Резюме (PDF)')

    const bar = wrapper.get('nav.bottom-bar')
    expect(bar.attributes('aria-label')).toBe('Главы')
    expect(bar.findAll('.route-stop__title').map((title) => title.text())).toEqual([
      'Профиль',
      'ProSpace',
      'TimePath',
      'Стек',
      'Учёба',
      'Контакты',
    ])

    const dialog = openDialog(wrapper)
    expect(dialog.get('h2').text()).toBe(ruContent.chapters.prospace.title)
    expect(dialog.get('.window__eyebrow').text()).toBe(
      'Остановка 2 из 6 · Накладная · Текущее место · янв – окт 2026',
    )
    expect(dialog.text()).toContain('Далее: 03 TimePath')
    expect(dialog.find('button[aria-label="Закрыть"]').exists()).toBe(true)
    await waitFor(() => document.documentElement.lang === 'ru')
    expect(document.documentElement.lang).toBe('ru')
  })

  it('switches EN → RU from the bar button without a reload: content, URL and <html lang>', async () => {
    const { wrapper } = mountApp()
    await flushPromises()
    await waitFor(() => document.documentElement.lang === 'en')
    const hero = wrapper.get('.hero')
    expect(hero.text()).toContain('Open to work')

    await wrapper
      .get('nav.bottom-bar button[aria-label="Language: English. Switch to Russian"]')
      .trigger('click')
    await flushPromises()

    expect(location.pathname).toBe('/ru/')
    expect(wrapper.get('.hero').element).toBe(hero.element)
    expect(hero.text()).toContain(ruContent.profile.status)
    expect(wrapper.get('.route-stop__title').text()).toBe('Профиль')
    await waitFor(() => document.documentElement.lang === 'ru')
    expect(document.documentElement.lang).toBe('ru')
    expect(localStorage.getItem('aboutme.lang')).toBe('ru')
    expect(
      wrapper.find('button[aria-label="Язык: русский. Переключить на английский"]').exists(),
    ).toBe(true)
  })

  it('opens /ru/ in Russian without remembering it as the visitor’s choice', async () => {
    history.replaceState(null, '', '/ru/')
    const { wrapper, ui } = mountApp()
    await flushPromises()

    expect(ui.lang).toBe('ru')
    expect(wrapper.get('.hero').text()).toContain('Яков Полежаев')
    expect(localStorage.getItem('aboutme.lang')).toBeNull()
  })

  it('moves between / and /ru/ on a language switch without reloading, keeping the open chapter', async () => {
    history.replaceState(null, '', '/#prospace')
    const { wrapper, ui } = mountApp()
    await flushPromises()

    ui.setLang('ru')
    await flushPromises()
    expect(location.pathname).toBe('/ru/')
    expect(location.hash).toBe('#prospace')
    expect(openDialog(wrapper).exists()).toBe(true)

    ui.setLang('en')
    await flushPromises()
    expect(location.pathname).toBe('/')
    expect(localStorage.getItem('aboutme.lang')).toBe('en')
  })

  it('has a language button in the top bar of the stacked layout', () => {
    setViewport(768)
    const { wrapper } = mountApp()

    expect(
      wrapper.find('.top-bar button[aria-label="Language: English. Switch to Russian"]').exists(),
    ).toBe(true)
  })

  it('renders the hero card and the chapters bar on desktop', () => {
    const { wrapper, ui } = mountApp()

    expect(ui.mode).toBe('3d')
    expect(wrapper.find('.hero--desktop').exists()).toBe(true)
    const bar = wrapper.get('nav[aria-label="Chapters"]')
    expect(bar.classes()).toContain('bottom-bar--desktop')
    expect(bar.findAll('.route-stop')).toHaveLength(6)
    expect(wrapper.find('.scene-placeholder').exists()).toBe(true)
  })

  it('uses the laptop hero and compact bar at 1280 px', () => {
    setViewport(1280)
    const { wrapper } = mountApp()

    expect(wrapper.find('.hero--laptop').exists()).toBe(true)
    expect(wrapper.get('nav[aria-label="Chapters"]').classes()).toContain('bottom-bar--compact')
  })

  it('stacks the hero over the scene on a tablet, with the theme toggle in the top bar', () => {
    setViewport(768)
    const { wrapper, ui } = mountApp()

    expect(ui.mode).toBe('3d')
    expect(wrapper.get('.app').classes()).toContain('app--stacked')
    expect(wrapper.get('.top-bar').text()).toContain('YP · .NET backend')
    const theme = wrapper.get('.top-bar button[aria-label^="Theme"]')
    expect(theme.attributes('aria-label')).toBe('Theme: day. Switch to evening')
    expect(theme.attributes('aria-pressed')).toBeUndefined()
    expect(wrapper.find('.top-bar button[aria-label="Pause animation"]').exists()).toBe(true)
    expect(wrapper.get('nav[aria-label="Chapters"]').classes()).toContain('bottom-bar--compact')
  })

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

    await wrapper.get('button[aria-label="TimePath · Previous role"]').trigger('click')

    expect(openDialog(wrapper).get('h2').text()).toBe('TimePath')
  })

  it('stacks TopBar → Hero → map → bar on a phone, without metrics or a Monitoring link', () => {
    setViewport(390)
    const { wrapper } = mountApp()

    const order = [...wrapper.get('.app').element.querySelectorAll('*')]
      .map((el) =>
        ['top-bar', 'hero', 'static-map', 'bottom-bar'].find((name) => el.classList.contains(name)),
      )
      .filter(Boolean)
    expect(order).toEqual(['top-bar', 'hero', 'static-map', 'bottom-bar'])

    const map = wrapper.get('.static-map').element
    const siblings = [...map.parentElement!.children].filter((el) => el !== map)
    expect(siblings.map((el) => el.textContent).join(' ')).not.toContain('Monitoring')
    expect(wrapper.get('.hero').text()).not.toContain('1000+')
  })

  it('shows the compact hero with CV from content on desktop', () => {
    const { wrapper } = mountApp()

    const hero = wrapper.get('.hero')
    expect(hero.classes()).toContain('hero--compact')
    expect(hero.get('a.btn--secondary').attributes('href')).toBe('/cv/Yakov_Polezhaev_CV_EN.pdf')
    expect(hero.find('a[aria-label="Telegram"]').exists()).toBe(true)
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

  it('cycles the theme from the bar, sets data-theme and remembers it', async () => {
    const { wrapper } = mountApp()
    expect(document.documentElement.dataset.theme).toBe('day')

    await wrapper.get('.bottom-bar__actions button[aria-label^="Theme"]').trigger('click')

    expect(document.documentElement.dataset.theme).toBe('evening')
    expect(wrapper.get('.app').attributes('data-theme')).toBe('evening')
    expect(localStorage.getItem('aboutme.theme')).toBe('evening')
  })

  it('lets ?theme= override the saved theme', () => {
    localStorage.setItem('aboutme.theme', 'evening')
    history.replaceState(null, '', '/?theme=night')

    mountApp()

    expect(document.documentElement.dataset.theme).toBe('night')
    expect(localStorage.getItem('aboutme.theme')).toBe('evening')
  })

  it('does not remember a theme that came from ?theme=', () => {
    history.replaceState(null, '', '/?theme=night')

    mountApp()

    expect(localStorage.getItem('aboutme.theme')).toBeNull()
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

      expect(loadSceneWhenIdle).not.toHaveBeenCalled()
    })

    it('marks scene_ready and replaces the placeholder once the first frame is drawn', async () => {
      sceneStub.drawsFirstFrame = true
      const mark = vi.spyOn(performance, 'mark')
      const { wrapper, ui } = mountApp()

      await vi.advanceTimersByTimeAsync(2000)

      expect(loadSceneWhenIdle).toHaveBeenCalledTimes(1)
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
      vi.mocked(loadSceneWhenIdle).mockClear()

      const next = mountApp()

      expect(next.ui.mode).toBe('2d')
      expect(loadSceneWhenIdle).not.toHaveBeenCalled()
    })
  })
})
