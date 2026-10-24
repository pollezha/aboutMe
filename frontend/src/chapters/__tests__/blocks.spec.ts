import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ChipList from '../blocks/ChipList.vue'
import WindowColumns from '../blocks/WindowColumns.vue'
import KeyResultList from '../blocks/KeyResultList.vue'
import MetaRow from '../blocks/MetaRow.vue'
import MetricGrid from '../blocks/MetricGrid.vue'
import SectionHeading from '../blocks/SectionHeading.vue'

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
afterEach(() => {
  window.matchMedia = originalMatchMedia
})

describe('MetaRow', () => {
  it('pairs the label with its value', () => {
    const wrapper = mount(MetaRow, { props: { label: 'TEAM', value: 'code review' } })

    expect(wrapper.get('dt').text()).toBe('TEAM')
    expect(wrapper.get('dt').classes()).toContain('t-label-eyebrow')
    expect(wrapper.get('dd').text()).toBe('code review')
    expect(wrapper.get('dd').classes()).toContain('t-body-strong')
  })
})

describe('ChipList', () => {
  it('lists the chips under a label that names the list', () => {
    const wrapper = mount(ChipList, { props: { label: 'LANGUAGES', items: ['EN B2', 'CS B2'] } })

    const list = wrapper.get('ul')
    const label = wrapper.get(`#${list.attributes('aria-labelledby')}`)
    expect(label.text()).toBe('LANGUAGES')
    expect(list.findAll('li').map((li) => li.text())).toEqual(['EN B2', 'CS B2'])
    expect(list.get('li').classes()).toContain('t-label-caption')
  })

  it('uses the mono style for a stack', () => {
    const wrapper = mount(ChipList, { props: { label: 'STACK', items: ['Kafka'], mono: true } })

    expect(wrapper.get('li').classes()).toContain('t-mono-stack')
  })
})

describe('KeyResultList', () => {
  it('renders each result with how it was done and a decorative check', () => {
    const items = [
      { result: 'Built the module', how: 'ASP.NET Core' },
      { result: 'Cut the latency', how: 'SQL' },
    ]
    const wrapper = mount(KeyResultList, { props: { items } })

    const rows = wrapper.findAll('ul > li')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.get('.t-body-strong').text()).toBe('Built the module')
    expect(rows[0]?.get('.t-body-small').text()).toBe('ASP.NET Core')
    expect(rows[0]?.get('.icon').attributes('aria-hidden')).toBe('true')
  })
})

describe('MetricGrid', () => {
  const metrics = [
    { label: 'VOLUME', value: '1000+', note: 'shipments / day', accent: true },
    { label: 'TABLES', value: '200+', note: 'tables', accent: false },
  ]

  it('shows md cards on desktop and the chapter colour on the accent card', () => {
    setViewport(1440)
    const wrapper = mount(MetricGrid, { props: { metrics, chapter: 'timepath' } })

    const cards = wrapper.findAll('.metric')
    expect(cards).toHaveLength(2)
    expect(cards[0]?.classes()).toContain('metric--md')
    expect(cards[0]?.attributes('style')).toContain('--chapter-timepath')
    expect(cards[1]?.classes()).not.toContain('metric--accent')
  })

  it('shows sm cards on a phone', () => {
    setViewport(390)
    const wrapper = mount(MetricGrid, { props: { metrics, chapter: 'prospace' } })

    expect(wrapper.get('.metric').classes()).toContain('metric--sm')
  })

  it('keeps a fixed size when asked and names the group', () => {
    setViewport(1440)
    const wrapper = mount(MetricGrid, {
      props: { metrics, chapter: 'profile', size: 'sm', label: 'KEY NUMBERS' },
    })

    expect(wrapper.get('.metric').classes()).toContain('metric--sm')
    const group = wrapper.get('[role="group"]')
    expect(wrapper.get(`#${group.attributes('aria-labelledby')}`).text()).toBe('KEY NUMBERS')
  })
})

describe('SectionHeading', () => {
  it('is an h3 in the section style', () => {
    const wrapper = mount(SectionHeading, { slots: { default: 'Key results' } })

    expect(wrapper.element.tagName).toBe('H3')
    expect(wrapper.classes()).toContain('t-heading-section')
    expect(wrapper.text()).toBe('Key results')
  })
})

describe('WindowColumns', () => {
  it('lays its children out side by side', () => {
    const wrapper = mount(WindowColumns, { slots: { default: '<p>A</p><p>B</p>' } })

    expect(wrapper.classes()).toContain('columns')
    expect(wrapper.findAll('p')).toHaveLength(2)
  })
})
