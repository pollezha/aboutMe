import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Icon from '../Icon.vue'
import RouteStop from '../RouteStop.vue'

const props = { index: '03', title: 'TimePath', subtitle: 'Previous role' }

describe('RouteStop', () => {
  it('is a button with number, title and subtitle', () => {
    const wrapper = mount(RouteStop, { props })

    expect(wrapper.element.tagName).toBe('BUTTON')
    expect(wrapper.attributes('type')).toBe('button')
    expect(wrapper.text()).toContain('03')
    expect(wrapper.text()).toContain('TimePath')
    expect(wrapper.text()).toContain('Previous role')
  })

  it('emits open synchronously on click (D5)', () => {
    const wrapper = mount(RouteStop, { props })

    wrapper.element.click()

    expect(wrapper.emitted('open')).toHaveLength(1)
  })

  it('marks the active stop with aria-current="step"', () => {
    const active = mount(RouteStop, { props: { ...props, state: 'active' } })
    const idle = mount(RouteStop, { props })

    expect(active.attributes('aria-current')).toBe('step')
    expect(idle.attributes('aria-current')).toBeUndefined()
  })

  it('shows a check icon instead of the number when visited', () => {
    const wrapper = mount(RouteStop, { props: { ...props, state: 'visited' } })

    expect(wrapper.findComponent(Icon).props('name')).toBe('check')
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('03')
    expect(wrapper.attributes('aria-current')).toBeUndefined()
  })

  it('shows the number and no icon by default', () => {
    const wrapper = mount(RouteStop, { props })

    expect(wrapper.findComponent(Icon).exists()).toBe(false)
  })
})
