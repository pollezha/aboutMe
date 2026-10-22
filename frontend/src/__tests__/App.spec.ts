import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import App from '../App.vue'
import { createAppI18n } from '../i18n'
import { useUiStore } from '../stores/ui'

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
  dialogProto.showModal = originalDialog.showModal
  dialogProto.close = originalDialog.close
})

function mountApp() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const i18n = createAppI18n()
  wrapper = mount(App, { global: { plugins: [pinia, i18n] } })
  return { wrapper, ui: useUiStore() }
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

  it('sets <html lang> to en by default and to ru after ui.setLang("ru")', async () => {
    document.documentElement.lang = ''
    const { ui } = mountApp()

    expect(document.documentElement.lang).toBe('en')

    ui.setLang('ru')
    await nextTick()

    expect(document.documentElement.lang).toBe('ru')
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

  it('stacks the hero over the scene on a tablet, with theme and language in the top bar', () => {
    setViewport(768)
    const { wrapper, ui } = mountApp()

    expect(ui.mode).toBe('3d')
    expect(wrapper.get('.app').classes()).toContain('app--stacked')
    expect(wrapper.get('.top-bar').text()).toContain('YP · .NET backend')
    expect(wrapper.find('.top-bar button[aria-label^="Theme"]').exists()).toBe(true)
    expect(wrapper.find('.top-bar button[aria-label="Pause animation"]').exists()).toBe(true)
    expect(wrapper.get('nav[aria-label="Chapters"]').classes()).toContain('bottom-bar--compact')
  })

  it('opens the ProSpace window right after a click on stop 02', async () => {
    const { wrapper, ui } = mountApp()

    await wrapper.findAll('.route-stop')[1]!.trigger('click')

    const dialog = openDialog(wrapper)
    expect(dialog.exists()).toBe(true)
    expect(dialog.get('h2').text()).toBe('ProSpace')
    expect(dialog.get('.window__eyebrow').text()).toContain('02')
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

    expect(ui.openWindow).toBeNull()
    expect(location.hash).toBe('')
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
  })

  it('opens the Contact window from the #contact deep link', async () => {
    history.replaceState(null, '', '/#contact')

    const { wrapper } = mountApp()
    await flushPromises()

    expect(openDialog(wrapper).get('h2').text()).toBe('Contact')
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
})
