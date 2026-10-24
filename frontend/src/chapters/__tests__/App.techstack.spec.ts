import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick } from 'vue'
import en from '../../../../content/en.json'
import App from '../../App.vue'
import { serverTenure } from '../../content/format'
import type { ContentBundle } from '../../content/types'
import { appPlugins } from '../../app/__tests__/appPlugins'
import { useRouteStore } from '../../route'

// Сценарии окна 04 Tech stack в составе App (TC-09). Окружение — как в App.spec.ts.
vi.mock('../scene/Scene.vue', () => ({
  default: defineComponent({ setup: () => () => h('div', { class: 'scene-stub' }) }),
}))

function setViewport(width: number) {
  window.innerWidth = width
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query)
    return {
      matches: !!min && width >= Number(min[1]),
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
const originalMatchMedia = window.matchMedia
const content = en as ContentBundle
const kafka = content.chapters.techstack.racks
  .flatMap((rack) => rack.servers)
  .find((server) => server.name === 'Kafka')!

let wrapper: VueWrapper | undefined

beforeEach(() => {
  localStorage.clear()
  history.replaceState(null, '', '/')
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
  window.matchMedia = originalMatchMedia
})

async function openTechStack(width: number) {
  setViewport(width)
  const pinia = createPinia()
  setActivePinia(pinia)
  wrapper = mount(App, {
    global: { plugins: appPlugins(pinia) },
    attachTo: document.body,
  })
  const route = useRouteStore()
  route.openChapter('techstack')
  await nextTick()
  const dialog = wrapper.get('dialog[open]')
  const kafkaButton = dialog.get('.rack-server[data-server="Kafka"]')
  return { route, dialog, kafkaButton }
}

describe('App · Tech stack window', () => {
  it('shows the Kafka details computed from the role dates (TC-09)', async () => {
    const { dialog, kafkaButton } = await openTechStack(1440)

    await kafkaButton.trigger('click')

    const panel = dialog.get('.server-details')
    expect(panel.get('h3').text()).toBe('Kafka')
    expect(panel.text()).toContain(serverTenure(kafka.usedIn, content.experience).label)
    expect(panel.text()).toContain(kafka.where)
    expect(panel.text()).toContain(kafka.what)
  })

  it('on a phone opens a bottom sheet; Esc closes only the sheet, not the window', async () => {
    const { route, dialog, kafkaButton } = await openTechStack(390)
    ;(kafkaButton.element as HTMLElement).focus()

    await kafkaButton.trigger('click')
    await nextTick()

    const sheet = dialog.get('[role="dialog"]')
    expect(sheet.element.contains(document.activeElement)).toBe(true)
    expect(kafkaButton.attributes('aria-expanded')).toBe('true')

    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    document.activeElement!.dispatchEvent(esc)
    await nextTick()

    expect(dialog.find('[role="dialog"]').exists()).toBe(false)
    expect(document.activeElement).toBe(kafkaButton.element)
    expect(route.openWindow).toBe('techstack')
  })
})
