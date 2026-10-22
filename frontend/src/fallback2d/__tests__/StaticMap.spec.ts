import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StaticMap from '../StaticMap.vue'
import source from '../StaticMap.vue?raw'

describe('StaticMap', () => {
  it('renders seven hotspot buttons named after their chapters', () => {
    const wrapper = mount(StaticMap, { props: { variant: 'tablet' } })

    const hotspots = wrapper.findAll('button.hotspot')
    expect(hotspots).toHaveLength(7)
    expect(hotspots.map((h) => h.attributes('aria-label'))).toEqual([
      'Profile · About me',
      'ProSpace · Latest role',
      'TimePath · Previous role',
      'Tech stack · Skills',
      'Education · HSE University',
      'Contact · Your team',
      'Monitoring · this site, live',
    ])
  })

  it('emits open with the chapter id on click', async () => {
    const wrapper = mount(StaticMap, { props: { variant: 'phone' } })

    await wrapper.get('button[aria-label="ProSpace · Latest role"]').trigger('click')

    expect(wrapper.emitted('open')).toEqual([['prospace']])
  })

  it('places hotspots in percent of the map box from the Figma geometry', () => {
    const wrapper = mount(StaticMap, { props: { variant: 'tablet' } })

    const style = wrapper.get('button[aria-label="ProSpace · Latest role"]').attributes('style')
    expect(style).toContain('left: 32.2%')
    expect(style).toContain('top: 21.9%')
    expect(style).toContain('width: 21.9%')
    expect(style).toContain('height: 19.7%')
  })

  it('uses the variant aspect ratio', () => {
    expect(mount(StaticMap, { props: { variant: 'tablet' } }).classes()).toContain(
      'static-map--tablet',
    )
    expect(source).toMatch(/\.static-map--tablet\s*\{[^}]*aspect-ratio:\s*736\s*\/\s*666/)
    expect(source).toMatch(/\.static-map--phone\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/)
  })

  it('shows a numbered pin in the chapter colour on route hotspots', () => {
    const wrapper = mount(StaticMap, { props: { variant: 'tablet' } })

    const pin = wrapper.get('button[aria-label="Tech stack · Skills"] .pin')
    expect(pin.text()).toBe('04')
    expect(pin.attributes('style')).toContain('--chapter-techstack')
  })

  it('keeps hotspots at least 44×44', () => {
    expect(source).toMatch(/\.hotspot\s*\{[^}]*min-width:\s*var\(--size-touch\)/)
    expect(source).toMatch(/\.hotspot\s*\{[^}]*min-height:\s*var\(--size-touch\)/)
  })

  it('hides the island image when it fails to load', async () => {
    const wrapper = mount(StaticMap, { props: { variant: 'tablet' } })

    const img = wrapper.get('img')
    expect(img.attributes('alt')).not.toBe('')
    await img.trigger('error')

    expect(wrapper.find('img').exists()).toBe(false)
  })
})
