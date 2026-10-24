import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import en from '../../../../content/en.json'
import App from '../../App.vue'
import { CHAPTERS } from '../../content/chapters'
import { resolveChapter } from '../../content/format'
import type { ContentBundle } from '../../content/types'
import { appPlugins } from '../../app/__tests__/appPlugins'
import { useRouteStore } from '../../route'
import { useModeStore } from '../../mode/useModeStore'

// Окна 01–08 в 2D-режиме (AC6 без 3D): WebGL нет → сцена не грузится, three не нужен.
const content = en as ContentBundle

function setViewport(width: number) {
  window.innerWidth = width
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query)
    return {
      matches: !!min && width >= Number(min[1]),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as MediaQueryList
  }) as typeof window.matchMedia
}

const dialogProto = HTMLDialogElement.prototype
const originalDialog = { showModal: dialogProto.showModal, close: dialogProto.close }
const originalMatchMedia = window.matchMedia

let wrapper: VueWrapper | undefined

beforeEach(() => {
  localStorage.clear()
  history.replaceState(null, '', '/')
  setViewport(1440)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
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
  window.matchMedia = originalMatchMedia
  dialogProto.showModal = originalDialog.showModal
  dialogProto.close = originalDialog.close
})

async function mountAt(hash: string) {
  history.replaceState(null, '', `/${hash}`)
  const pinia = createPinia()
  setActivePinia(pinia)
  wrapper = mount(App, { global: { plugins: appPlugins(pinia) }, attachTo: document.body })
  await flushPromises()
  return { wrapper, mode: useModeStore(), route: useRouteStore() }
}

function openDialog(w: VueWrapper) {
  return w.get('dialog[open]')
}

describe('chapter windows in 2D mode', () => {
  it.each(CHAPTERS.map((chapter) => chapter.id))(
    '#%s opens its window from a deep link',
    async (id) => {
      const { wrapper, mode } = await mountAt(`#${id}`)

      expect(mode.mode).toBe('2d')
      const dialog = openDialog(wrapper)
      expect(dialog.attributes('data-chapter')).toBe(id)
      expect(dialog.get('h2').text()).toBe(resolveChapter(content, id).title)
      expect(dialog.find('.window__body .chapter-body').exists()).toBe(true)
    },
  )

  it('opens every map hotspot as a window with its body', async () => {
    const { wrapper, route } = await mountAt('')

    const hotspots = wrapper.findAll('.static-map button.hotspot')
    expect(hotspots.length).toBeGreaterThan(0)
    for (const hotspot of hotspots) {
      await hotspot.trigger('click')
      await nextTick()
      const id = route.openWindow
      expect(id).not.toBeNull()
      const dialog = openDialog(wrapper)
      expect(dialog.find('.window__body .chapter-body').exists()).toBe(true)
      route.closeWindow()
      await nextTick()
    }
  })

  it('#summary opens the summary without prev/next', async () => {
    const { wrapper } = await mountAt('#summary')

    const dialog = openDialog(wrapper)
    expect(dialog.get('h2').text()).toBe(content.chapters.summary.title)
    expect(dialog.find('.window__nav').exists()).toBe(false)
  })

  it('goes Contact → 30-second summary → Contact inside the window', async () => {
    const { wrapper } = await mountAt('#contact')

    const summaryLink = openDialog(wrapper)
      .findAll('.window__body button')
      .find((button) => button.text() === content.chapters.contact.summaryLink.label)
    await summaryLink?.trigger('click')
    await nextTick()
    expect(openDialog(wrapper).attributes('data-chapter')).toBe('summary')
    expect(location.hash).toBe('#summary')

    await openDialog(wrapper).get('.window__body button.btn--primary').trigger('click')
    await nextTick()
    expect(openDialog(wrapper).attributes('data-chapter')).toBe('contact')
  })
})
