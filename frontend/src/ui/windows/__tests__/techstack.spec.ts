import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import en from '../../../../../content/en.json'
import { serverTenure } from '../../../content/format'
import type { ContentBundle } from '../../../content/types'
import { WINDOWS } from '..'
import TechStackWindow from '../TechStackWindow.vue'

const content = en as ContentBundle
const now = new Date(2026, 9, 23)

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

const originalMatchMedia = window.matchMedia
let wrapper: VueWrapper | undefined

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  window.matchMedia = originalMatchMedia
})

function mountWindow(width: number, bundle: ContentBundle = content) {
  setViewport(width)
  wrapper = mount(TechStackWindow, { props: { content: bundle, now }, attachTo: document.body })
  return wrapper
}

function server(w: VueWrapper, name: string) {
  const button = w.findAll('.rack-server').find((b) => b.get('.rack-server__name').text() === name)
  if (!button) throw new Error(`no server ${name}`)
  return button
}

const kafka = content.chapters.techstack.racks
  .flatMap((rack) => rack.servers)
  .find((s) => s.name === 'Kafka')!

describe('TechStackWindow on desktop', () => {
  it('is the techstack window body', () => {
    expect(WINDOWS.techstack.body).toBe(TechStackWindow)
  })

  it('renders every rack as a labelled group of servers with computed terms', () => {
    const w = mountWindow(1440)

    const racks = w.findAll('[role="group"]')
    expect(racks.map((r) => r.attributes('aria-label'))).toEqual(
      content.chapters.techstack.racks.map((r) => r.name),
    )
    expect(server(w, 'Kafka').get('.rack-server__term').text()).toBe('9 m')
    expect(server(w, 'C# / .NET').get('.rack-server__term').text()).toBe('2 y 3 m')
  })

  it('selects the first server of the first rack by default', () => {
    const w = mountWindow(1440)

    const first = w.findAll('.rack-server')[0]!
    expect(first.attributes('aria-pressed')).toBe('true')
    expect(w.get('.server-details h3').text()).toBe('C# / .NET')
  })

  it('shows the Kafka term from the dates, where and what after a click (TC-09)', async () => {
    const w = mountWindow(1440)

    await server(w, 'Kafka').trigger('click')

    const details = w.get('.server-details')
    expect(details.get('h3').text()).toBe('Kafka')
    const expected = serverTenure(kafka.usedIn, content.experience, now).label
    expect(expected).toBe('9 m · since Jan 2026')
    expect(details.text()).toContain(`EXPERIENCE${expected}`)
    expect(details.text()).toContain(kafka.where)
    expect(details.text()).toContain(kafka.what)
    expect(server(w, 'Kafka').attributes('aria-pressed')).toBe('true')
    expect(w.findAll('.rack-server[aria-pressed="true"]')).toHaveLength(1)
    expect(server(w, 'Kafka').attributes('aria-expanded')).toBeUndefined()
  })

  it('counts overlapping roles of one server once', async () => {
    const bundle: ContentBundle = {
      ...content,
      experience: [
        { id: 'timepath', company: 'T', role: 'Dev', from: '2025-01', to: '2025-12' },
        { id: 'prospace', company: 'P', role: 'Dev', from: '2025-07', to: '2026-06' },
      ],
    }
    const w = mountWindow(1440, bundle)

    expect(server(w, 'Docker').get('.rack-server__term').text()).toBe('1 y 6 m')
  })

  it('moves focus between servers of a rack with arrows (roving tabindex), Enter selects', async () => {
    const w = mountWindow(1440)
    const messaging = w.findAll('[role="group"]')[2]!
    const buttons = messaging.findAll('.rack-server')
    expect(buttons.map((b) => b.attributes('tabindex'))).toEqual(['0', '-1', '-1'])

    ;(buttons[0]!.element as HTMLElement).focus()
    await buttons[0]!.trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(buttons[1]!.element)
    expect(buttons.map((b) => b.attributes('tabindex'))).toEqual(['-1', '0', '-1'])

    await buttons[1]!.trigger('keydown', { key: 'ArrowDown' })
    await buttons[2]!.trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(buttons[0]!.element)

    await buttons[0]!.trigger('keydown', { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(buttons[2]!.element)
    await buttons[2]!.trigger('keydown', { key: 'Enter' })
    expect(w.get('.server-details h3').text()).toBe('SignalR')
    expect(buttons[2]!.attributes('aria-pressed')).toBe('true')
  })
})

describe('TechStackWindow on a phone (390 px)', () => {
  it('has no side panel and stacks the racks', () => {
    const w = mountWindow(390)

    expect(w.find('.server-details').exists()).toBe(false)
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    expect(server(w, 'Kafka').attributes('aria-expanded')).toBe('false')
  })

  it('opens the details in a bottom sheet, focuses it, Esc returns focus', async () => {
    const w = mountWindow(390)
    const button = server(w, 'Kafka')
    ;(button.element as HTMLElement).focus()

    await button.trigger('click')
    await nextTick()

    const sheet = w.get('[role="dialog"]')
    expect(sheet.attributes('aria-modal')).toBe('true')
    expect(w.get(`#${sheet.attributes('aria-labelledby')}`).text()).toBe('Kafka')
    expect(sheet.text()).toContain('9 m · since Jan 2026')
    expect(sheet.text()).toContain(kafka.what)
    expect(sheet.element.contains(document.activeElement)).toBe(true)
    expect(button.attributes('aria-expanded')).toBe('true')

    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    document.activeElement!.dispatchEvent(esc)
    await nextTick()

    expect(esc.defaultPrevented).toBe(true)
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    expect(document.activeElement).toBe(button.element)
    expect(button.attributes('aria-expanded')).toBe('false')
  })

  it('closes the sheet by the close button and by the scrim', async () => {
    const w = mountWindow(390)

    await server(w, 'Kafka').trigger('click')
    await w.get('[role="dialog"] button[aria-label="Close"]').trigger('click')
    expect(w.find('[role="dialog"]').exists()).toBe(false)

    await server(w, 'Docker').trigger('click')
    await w.get('.bottom-sheet__scrim').trigger('click')
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    expect(document.activeElement).toBe(server(w, 'Docker').element)
  })

  it('keeps Tab inside the sheet', async () => {
    const w = mountWindow(390)
    await server(w, 'Kafka').trigger('click')
    await nextTick()

    const close = w.get('[role="dialog"] button[aria-label="Close"]')
    expect(document.activeElement).toBe(close.element)
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    close.element.dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(close.element)
  })
})
