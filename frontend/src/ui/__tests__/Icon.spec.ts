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
  'pause',
  'play',
  'rotate',
  'telegram',
  'theme',
]

describe('Icon', () => {
  it('ships exactly the 13 design-system icons', () => {
    expect([...ICON_NAMES].sort()).toEqual(EXPECTED)
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

  it('every icon is a 24×24 stroke icon on currentColor', () => {
    for (const name of ICON_NAMES) {
      const svg = mount(Icon, { props: { name } }).get('svg')
      expect(svg.attributes('viewBox')).toBe('0 0 24 24')
      expect(svg.attributes('stroke')).toBe('currentColor')
      expect(svg.attributes('fill')).toBe('none')
    }
  })
})
