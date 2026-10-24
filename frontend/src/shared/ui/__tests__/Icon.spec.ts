import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Icon from '../Icon.vue'
import { ICON_NAMES } from '../icon-registry'

const EXPECTED = [
  'arrow-right',
  'check',
  'close',
  'download',
  'email',
  'external',
  'github',
  'lang',
  'map',
  'pause',
  'play',
  'rotate',
  'telegram',
  'theme',
]

// Знаки глав (EyebrowRow окон, Figma Icon/sign-*): 20×20, stroke 1.75 — экспорт 2026-10-23.
const SIGNS = [
  'sign-diploma',
  'sign-envelope',
  'sign-licence',
  'sign-monitoring',
  'sign-rack',
  'sign-route',
  'sign-summary',
  'sign-waybill',
]

describe('Icon', () => {
  it('ships exactly the 14 UI icons and 8 chapter signs', () => {
    expect([...ICON_NAMES].sort()).toEqual([...EXPECTED, ...SIGNS].sort())
  })

  it('renders inline SVG hidden from assistive tech by default', () => {
    const wrapper = mount(Icon, { props: { name: 'check' } })

    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.get('.icon').attributes('aria-hidden')).toBe('true')
    expect(wrapper.get('.icon').attributes('role')).toBeUndefined()
  })

  it('becomes an img with aria-label when label is given', () => {
    const wrapper = mount(Icon, { props: { name: 'github', label: 'GitHub' } })

    expect(wrapper.get('.icon').attributes('role')).toBe('img')
    expect(wrapper.get('.icon').attributes('aria-label')).toBe('GitHub')
    expect(wrapper.get('.icon').attributes('aria-hidden')).toBeUndefined()
  })

  it('every icon is a stroke icon on currentColor (24×24 UI, 20×20 signs)', () => {
    for (const name of ICON_NAMES) {
      const svg = mount(Icon, { props: { name } }).get('svg')
      expect(svg.attributes('viewBox')).toBe(name.startsWith('sign-') ? '0 0 20 20' : '0 0 24 24')
      expect(svg.attributes('stroke')).toBe('currentColor')
      expect(svg.attributes('fill')).toBe('none')
    }
  })
})
