import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseButton from '../BaseButton.vue'

describe('BaseButton', () => {
  it('renders a <button type="button"> with primary/md classes by default', () => {
    const wrapper = mount(BaseButton, { slots: { default: 'Contact' } })

    const button = wrapper.get('button')
    expect(button.attributes('type')).toBe('button')
    expect(button.text()).toContain('Contact')
    expect(button.classes()).toEqual(expect.arrayContaining(['btn--primary', 'btn--md']))
  })

  it('maps variant and size props to classes', () => {
    const wrapper = mount(BaseButton, { props: { variant: 'ghost', size: 'lg' } })

    const button = wrapper.get('button')
    expect(button.classes()).toEqual(expect.arrayContaining(['btn--ghost', 'btn--lg']))
    expect(button.classes()).not.toContain('btn--primary')
  })

  it('passes type through', () => {
    const wrapper = mount(BaseButton, { props: { type: 'submit' } })

    expect(wrapper.get('button').attributes('type')).toBe('submit')
  })

  it('sets disabled and aria-disabled when disabled', () => {
    const wrapper = mount(BaseButton, { props: { disabled: true } })

    const button = wrapper.get('button')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.attributes('aria-disabled')).toBe('true')
  })

  it('renders the icon slot after the label', () => {
    const wrapper = mount(BaseButton, {
      slots: { default: 'Open', icon: '<span data-test="icon">→</span>' },
    })

    const icon = wrapper.get('[data-test="icon"]')
    expect(wrapper.get('button').element.lastElementChild?.contains(icon.element)).toBe(true)
  })

  it('passes aria-* attributes through to the button', () => {
    const wrapper = mount(BaseButton, { attrs: { 'aria-describedby': 'hint' } })

    expect(wrapper.get('button').attributes('aria-describedby')).toBe('hint')
  })
})
