import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import type { Component } from 'vue'
import en from '../../../../../content/en.json'
import type { ContentBundle } from '../../../content/types'
import { createAppI18n } from '../../../i18n'
import { useUiStore } from '../../../stores/ui'
import { WINDOWS } from '..'
import ContactWindow from '../ContactWindow.vue'
import EducationWindow from '../EducationWindow.vue'
import MonitoringWindow from '../MonitoringWindow.vue'
import SummaryWindow from '../SummaryWindow.vue'

const content = en as ContentBundle
const now = new Date(2026, 9, 23)

let pinia: Pinia

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function mountWindow(component: Component) {
  return mount(component, {
    props: { content, now },
    global: { plugins: [pinia, createAppI18n()] },
  })
}

describe('EducationWindow', () => {
  it('shows the programme meta, team projects and study + work as lists', () => {
    const wrapper = mountWindow(EducationWindow)
    const { education } = content.chapters

    expect(wrapper.text()).toContain(education.programme.value)
    expect(wrapper.text()).toContain(education.thesis.value)
    const lists = wrapper.findAll('ul.bullets__list')
    expect(lists.map((list) => list.findAll('li').map((li) => li.text()))).toEqual([
      education.teamProjects.items,
      education.studyWork.items,
    ])
  })

  it('shows courses and languages as mono chips and no diploma placeholder', () => {
    const wrapper = mountWindow(EducationWindow)

    const chips = wrapper.findAll('.chips__chip.t-mono-stack').map((chip) => chip.text())
    expect(chips).toEqual([
      ...content.chapters.education.courses.items,
      ...content.chapters.education.languages.items,
    ])
    expect(wrapper.text()).not.toMatch(/diploma/i)
  })
})

describe('ContactWindow', () => {
  it('has exactly one primary button and it leads to Telegram', () => {
    const wrapper = mountWindow(ContactWindow)

    const primary = wrapper.findAll('.btn--primary')
    expect(primary).toHaveLength(1)
    expect(primary[0]?.element.tagName).toBe('A')
    expect(primary[0]?.attributes('href')).toBe(content.chapters.contact.mailbox.action.href)
    expect(primary[0]?.text()).toBe('Write me on Telegram')
  })

  it('links both CVs as downloads among secondary contact buttons', () => {
    const wrapper = mountWindow(ContactWindow)

    const secondary = wrapper.findAll('a.btn--secondary')
    expect(secondary.map((a) => a.attributes('href'))).toEqual(
      content.chapters.contact.contacts.map((c) => c.href),
    )
    const cvs = secondary.filter((a) => a.attributes('href')?.endsWith('.pdf'))
    expect(cvs.map((a) => a.attributes('href'))).toEqual([
      '/cv/Yakov_Polezhaev_CV_EN.pdf',
      '/cv/Yakov_Polezhaev_CV_RU.pdf',
    ])
    for (const cv of cvs) expect(cv.attributes()).toHaveProperty('download')
  })

  it('computes the role experience from the dates and shows the status pill', () => {
    const wrapper = mountWindow(ContactWindow)

    expect(wrapper.text()).toContain('.NET Backend Developer · 2 yrs 3 mo in production')
    expect(wrapper.get('.status-pill').text()).toBe(content.chapters.contact.status.value)
  })

  it('opens the 30-second summary from its link', async () => {
    const wrapper = mountWindow(ContactWindow)

    const link = wrapper.findAll('button.btn--ghost').find((b) => b.text() === '30-second summary')
    expect(link).toBeDefined()
    await link?.trigger('click')

    expect(useUiStore().openWindow).toBe('summary')
  })
})

describe('SummaryWindow', () => {
  it('shows three metrics with the experience computed from the dates', () => {
    const wrapper = mountWindow(SummaryWindow)

    const values = wrapper.findAll('.metric__value').map((v) => v.text())
    expect(values.slice(0, 2)).toEqual(['1000+', '40 s → 2 s'])
    expect(values).toHaveLength(3)
    expect(wrapper.text()).toContain('since July 2024, two companies')
  })

  it('lists what I do and offers Contact (opens the window) and the CV', async () => {
    const wrapper = mountWindow(SummaryWindow)

    expect(wrapper.findAll('.key-results > li')).toHaveLength(
      content.chapters.summary.whatIDo.items.length,
    )
    const contact = wrapper.get('button.btn--primary')
    expect(contact.text()).toBe('Contact')
    const cv = wrapper.get('a.btn--secondary')
    expect(cv.attributes('href')).toBe('/cv/Yakov_Polezhaev_CV_EN.pdf')
    expect(cv.attributes()).toHaveProperty('download')

    await contact.trigger('click')
    expect(useUiStore().openWindow).toBe('contact')
  })
})

describe('MonitoringWindow (offline, stage 3)', () => {
  it('announces the offline state and shows six empty small metrics', () => {
    const wrapper = mountWindow(MonitoringWindow)

    const status = wrapper.get('[role="status"]')
    expect(status.attributes('aria-live')).toBe('polite')
    expect(status.text()).toBe('offline · backend arrives with stage 4')
    const cards = wrapper.findAll('.metric')
    expect(cards.map((c) => c.get('.metric__label').text())).toEqual(
      content.chapters.monitoring.metrics.map((m) => m.label),
    )
    expect(cards.every((c) => c.get('.metric__value').text() === '—')).toBe(true)
    expect(cards.every((c) => c.classes('metric--sm'))).toBe(true)
  })

  it('draws the path of a click with the first and last steps inverted', () => {
    const wrapper = mountWindow(MonitoringWindow)

    const steps = wrapper.findAll('.flow__step')
    expect(steps.map((s) => s.text())).toEqual(content.chapters.monitoring.clickPath.steps)
    expect(steps.map((s) => s.classes('flow__step--edge'))).toEqual(
      steps.map((_, i) => i === 0 || i === steps.length - 1),
    )
    expect(wrapper.findAll('.flow .icon[aria-hidden="true"]')).toHaveLength(steps.length - 1)
  })

  it('lists logs, metrics and traces', () => {
    const wrapper = mountWindow(MonitoringWindow)

    const labels = wrapper.findAll('.observability dt').map((dt) => dt.text())
    expect(labels).toEqual(['LOGS', 'METRICS', 'TRACES'])
  })

  it('makes no network requests', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const xhrOpen = vi.spyOn(XMLHttpRequest.prototype, 'open')

    const wrapper = mountWindow(MonitoringWindow)
    await flushPromises()
    wrapper.unmount()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(xhrOpen).not.toHaveBeenCalled()
  })
})

describe('window registry (05–08)', () => {
  it('maps education, contact, summary and monitoring to their windows', () => {
    expect(WINDOWS.education.body).toBe(EducationWindow)
    expect(WINDOWS.contact.body).toBe(ContactWindow)
    expect(WINDOWS.summary.body).toBe(SummaryWindow)
    expect(WINDOWS.monitoring.body).toBe(MonitoringWindow)
  })
})
