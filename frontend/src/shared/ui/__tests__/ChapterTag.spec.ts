import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ChapterTag from '../ChapterTag.vue'

const props = {
  chapter: 'prospace',
  number: '02',
  title: 'ProSpace',
  subtitle: 'Experience',
} as const

describe('ChapterTag', () => {
  it('points --chapter at the chapter colour variable', () => {
    const wrapper = mount(ChapterTag, { props })

    expect(wrapper.attributes('style')).toContain('--chapter: var(--chapter-prospace)')
  })

  it('renders as a button by default', () => {
    const wrapper = mount(ChapterTag, { props })

    expect(wrapper.element.tagName).toBe('BUTTON')
    expect(wrapper.attributes('type')).toBe('button')
  })

  it('renders as a div when as="div"', () => {
    const wrapper = mount(ChapterTag, { props: { ...props, as: 'div' } })

    expect(wrapper.element.tagName).toBe('DIV')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('shows number, title and subtitle', () => {
    const wrapper = mount(ChapterTag, { props })

    expect(wrapper.text()).toContain('02')
    expect(wrapper.text()).toContain('ProSpace')
    expect(wrapper.text()).toContain('Experience')
  })

  it('takes the number ink from the per-theme --pin-ink-<chapter> token', () => {
    const summary = mount(ChapterTag, { props: { ...props, chapter: 'summary' } })
    const prospace = mount(ChapterTag, { props })

    expect(summary.attributes('style')).toContain('--chapter-ink: var(--pin-ink-summary)')
    expect(prospace.attributes('style')).toContain('--chapter-ink: var(--pin-ink-prospace)')
  })
})
