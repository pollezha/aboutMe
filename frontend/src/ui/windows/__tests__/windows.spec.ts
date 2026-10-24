import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import en from '../../../../../content/en.json'
import { ROUTE, CHAPTERS } from '../../../content/chapters'
import { resolveHighlights } from '../../../content/experience'
import type { ContentBundle } from '../../../content/types'
import { WINDOWS } from '..'
import ProfileWindow from '../ProfileWindow.vue'
import ProSpaceWindow from '../ProSpaceWindow.vue'
import TimePathWindow from '../TimePathWindow.vue'

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
afterEach(() => {
  window.matchMedia = originalMatchMedia
})

describe('ProfileWindow', () => {
  it('shows the same KEY NUMBERS as the Hero, as small cards', () => {
    setViewport(1440)
    const wrapper = mount(ProfileWindow, { props: { content, now } })

    const group = wrapper.get('[role="group"]')
    expect(wrapper.get(`#${group.attributes('aria-labelledby')}`).text()).toBe('KEY NUMBERS')
    const values = group.findAll('.metric__value').map((v) => v.text())
    expect(values).toEqual(resolveHighlights(content, now).map((m) => m.value))
    expect(group.get('.metric').classes()).toContain('metric--sm')
  })

  it('computes the time on the road from the dates and renders no photo', () => {
    const wrapper = mount(ProfileWindow, { props: { content, now } })

    expect(wrapper.text()).toContain('July 2024 · 2 yrs 3 mo in production')
    expect(wrapper.text()).toContain(content.chapters.profile.lookingFor.value)
    expect(wrapper.findAll('li').map((li) => li.text())).toEqual(
      content.chapters.profile.languages.items,
    )
    expect(wrapper.find('img').exists()).toBe(false)
  })
})

describe('ProSpaceWindow', () => {
  it('lists the key results from the content', () => {
    const wrapper = mount(ProSpaceWindow, { props: { content, now } })

    const { keyResults } = content.chapters.prospace
    expect(wrapper.get('h3').text()).toBe(keyResults.heading)
    const results = wrapper.findAll('.key-results > li .t-body-strong').map((r) => r.text())
    expect(results).toEqual(keyResults.items.map((item) => item.result))
  })

  it('shows the metrics, stack and team', () => {
    setViewport(1440)
    const wrapper = mount(ProSpaceWindow, { props: { content, now } })

    const cards = wrapper.findAll('.metric')
    expect(cards.map((c) => c.get('.metric__value').text())).toEqual(['1000+', '200+', 'Transport'])
    expect(cards[0]?.classes()).toContain('metric--md')
    expect(cards[0]?.attributes('style')).toContain('--chapter-prospace')
    expect(wrapper.text()).toContain('Kafka')
    expect(wrapper.text()).toContain(content.chapters.prospace.team.value)
  })
})

describe('TimePathWindow', () => {
  it('groups the metrics and paints the accent card in its own chapter colour', () => {
    setViewport(1440)
    const wrapper = mount(TimePathWindow, { props: { content, now } })

    const groups = wrapper.findAll('[role="group"]')
    expect(groups).toHaveLength(2)
    expect(groups[1]?.text()).toContain('FILTER PAGE LOAD')
    const accent = wrapper.get('.metric--accent')
    expect(accent.text()).toContain('< 2 s')
    expect(accent.attributes('style')).toContain('--chapter-timepath')
  })

  it('lists key results and stack from the content', () => {
    const wrapper = mount(TimePathWindow, { props: { content, now } })

    expect(wrapper.findAll('.key-results > li')).toHaveLength(
      content.chapters.timepath.keyResults.items.length,
    )
    expect(wrapper.text()).toContain('SQL Server')
  })
})

describe('window registry', () => {
  it('has a body and a sign for every chapter', () => {
    for (const chapter of CHAPTERS) {
      expect(WINDOWS[chapter.id].body).toBeDefined()
      expect(WINDOWS[chapter.id].sign).toMatch(/^sign-/)
    }
  })

  it('maps the first three stops to their windows', () => {
    expect(ROUTE.slice(0, 3).map((chapter) => WINDOWS[chapter.id].body)).toEqual([
      ProfileWindow,
      ProSpaceWindow,
      TimePathWindow,
    ])
  })
})

// Исходники окон глав по именам, от корня проекта — не зависят от того, в какой папке лежат: тела окон
// (*Window.vue, кроме рамки ChapterWindow), блоки, ProofLinks и реестр окон (.ts рядом с этим спеком).
const sources = import.meta.glob<string>(
  [
    '/src/**/*Window.vue',
    '/src/**/blocks/*.vue',
    '/src/**/ProofLinks.vue',
    '../*.ts',
    '!/src/**/ChapterWindow.vue',
    '!**/__tests__/**',
  ],
  { query: '?raw', import: 'default', eager: true },
)

// Число исходников на момент M2 (этап 3b): 8 окон + 12 блоков + реестр. Переезд файлов не должен молча
// сузить проверку.
const MIN_FILES = 21

describe('window sources', () => {
  it('finds the window sources', () => {
    expect(Object.keys(sources).length).toBeGreaterThanOrEqual(MIN_FILES)
  })

  it.each(Object.keys(sources))('%s hardcodes no dates (they come from experience[])', (file) => {
    expect(sources[file]).not.toMatch(/\b20\d\d\b/)
  })

  it.each(Object.keys(sources))('%s has no raw colours anywhere', (file) => {
    const source = sources[file] ?? ''
    expect(source).not.toMatch(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/)
    expect(source).not.toMatch(/rgba?\(|hsla?\(/)
  })
})
