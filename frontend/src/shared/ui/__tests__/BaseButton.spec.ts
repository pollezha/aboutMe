import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseButton from '../BaseButton.vue'
import source from '../BaseButton.vue?raw'

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

  it('renders a link with the same classes when as="a"', () => {
    const wrapper = mount(BaseButton, {
      props: { as: 'a', href: '/cv.pdf', variant: 'secondary' },
      slots: { default: 'CV (PDF)' },
    })

    const link = wrapper.get('a')
    expect(wrapper.find('button').exists()).toBe(false)
    expect(link.attributes('href')).toBe('/cv.pdf')
    expect(link.attributes('type')).toBeUndefined()
    expect(link.classes()).toEqual(expect.arrayContaining(['btn', 'btn--secondary', 'btn--md']))
    expect(link.text()).toContain('CV (PDF)')
  })

  it('adds rel=noopener to links opened in a new tab', () => {
    const wrapper = mount(BaseButton, {
      props: { as: 'a', href: 'https://t.me/x', target: '_blank' },
    })

    const link = wrapper.get('a')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toContain('noopener')
  })

  it('keeps an explicit rel and still adds noopener for _blank', () => {
    const wrapper = mount(BaseButton, {
      props: { as: 'a', href: 'https://t.me/x', target: '_blank', rel: 'me' },
    })

    expect(wrapper.get('a').attributes('rel')?.split(' ')).toEqual(
      expect.arrayContaining(['me', 'noopener']),
    )
  })

  // Night: кольцо фокуса жёлтое, как и Primary (1:1) — между ними 2px bg/surface (WCAG 1.4.11).
  it('separates the focus ring from the yellow primary button with an inner surface ring', () => {
    const rule = /\.btn--primary:focus-visible\s*\{([^}]*)\}/.exec(source)?.[1] ?? ''

    expect(rule).toMatch(/outline:\s*2px solid var\(--focus-ring\)/)
    expect(rule).toMatch(/outline-offset:\s*2px/)
    expect(rule).toMatch(/box-shadow:[^;]*0 0 0 2px var\(--bg-surface\)/)
  })
})
