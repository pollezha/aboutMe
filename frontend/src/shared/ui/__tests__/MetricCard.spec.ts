import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MetricCard from '../MetricCard.vue'

const props = { label: 'FILTER PAGE', value: '40 s → 2 s', note: 'after moving filters to SQL' }

describe('MetricCard', () => {
  it('shows label, value and note', () => {
    const wrapper = mount(MetricCard, { props })

    expect(wrapper.text()).toContain('FILTER PAGE')
    expect(wrapper.text()).toContain('40 s → 2 s')
    expect(wrapper.text()).toContain('after moving filters to SQL')
  })

  it('points --chapter at the chapter colour for the accent tone', () => {
    const wrapper = mount(MetricCard, { props: { ...props, tone: 'accent', chapter: 'prospace' } })

    expect(wrapper.attributes('style')).toContain('--chapter: var(--chapter-prospace)')
    expect(wrapper.classes()).toContain('metric--accent')
  })

  it('sets no chapter colour for the default tone', () => {
    const wrapper = mount(MetricCard, { props: { ...props, chapter: 'prospace' } })

    expect(wrapper.attributes('style')).toBeUndefined()
    expect(wrapper.classes()).not.toContain('metric--accent')
  })

  it('uses the small number style for size sm', () => {
    const md = mount(MetricCard, { props })
    const sm = mount(MetricCard, { props: { ...props, size: 'sm' } })

    expect(md.find('.t-display-number').text()).toBe('40 s → 2 s')
    expect(sm.find('.t-display-number-sm').text()).toBe('40 s → 2 s')
  })
})
