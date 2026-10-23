import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createAppI18n } from '../../i18n'
import StaticMap from '../StaticMap.vue'
import source from '../StaticMap.vue?raw'

function mountMap(variant: 'tablet' | 'phone', locale: 'en' | 'ru' = 'en') {
  return mount(StaticMap, { props: { variant }, global: { plugins: [createAppI18n(locale)] } })
}

describe('StaticMap', () => {
  it('renders seven hotspot buttons named after their chapters', () => {
    const wrapper = mountMap('tablet')

    const hotspots = wrapper.findAll('button.hotspot')
    expect(hotspots).toHaveLength(7)
    expect(hotspots.map((h) => h.attributes('aria-label'))).toEqual([
      'Profile · About me',
      'ProSpace · Latest role',
      'TimePath · Previous role',
      'Tech stack · Skills',
      'Education · BSc 2025',
      'Contact · Your team',
      'Monitoring · This site, live',
    ])
  })

  it('names hotspots and the image in Russian', () => {
    const wrapper = mountMap('phone', 'ru')

    expect(wrapper.get('button.hotspot').attributes('aria-label')).toBe('Профиль · Обо мне')
    expect(wrapper.get('img').attributes('alt')).toContain('Изометрический остров')
  })

  it('emits open with the chapter id on click', async () => {
    const wrapper = mountMap('phone')

    await wrapper.get('button[aria-label="ProSpace · Latest role"]').trigger('click')

    expect(wrapper.emitted('open')).toEqual([['prospace']])
  })

  it('places hotspots in percent of the map box from the Figma geometry', () => {
    const wrapper = mountMap('tablet')

    const style = wrapper.get('button[aria-label="ProSpace · Latest role"]').attributes('style')
    expect(style).toContain('left: 32.2%')
    expect(style).toContain('top: 21.9%')
    expect(style).toContain('width: 21.9%')
    expect(style).toContain('height: 19.7%')
  })

  it('uses the variant aspect ratio', () => {
    expect(mountMap('tablet').classes()).toContain('static-map--tablet')
    expect(source).toMatch(/\.static-map--tablet\s*\{[^}]*aspect-ratio:\s*736\s*\/\s*666/)
    expect(source).toMatch(/\.static-map--phone\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/)
  })

  it('shows a numbered pin in the chapter colour on route hotspots', () => {
    const wrapper = mountMap('tablet')

    const pin = wrapper.get('button[aria-label="Tech stack · Skills"] .pin')
    expect(pin.text()).toBe('04')
    expect(pin.attributes('style')).toContain('--chapter-techstack')
  })

  it('draws the pin number and dot in the per-theme --pin-ink-<chapter> token', () => {
    const wrapper = mountMap('tablet')

    const pin = wrapper.get('button[aria-label="ProSpace · Latest role"] .pin')
    expect(pin.attributes('style')).toContain('--pin-ink: var(--pin-ink-prospace)')
    expect(source).toMatch(/\.pin\s*\{[^}]*color:\s*var\(--pin-ink\)/)
    expect(source).toMatch(/\.pin__dot\s*\{[^}]*border:[^;]*var\(--pin-ink\)/)
    expect(source).not.toContain('--text-on-dark')
  })

  it('keeps hotspots at least 44×44', () => {
    expect(source).toMatch(/\.hotspot\s*\{[^}]*min-width:\s*var\(--size-touch\)/)
    expect(source).toMatch(/\.hotspot\s*\{[^}]*min-height:\s*var\(--size-touch\)/)
  })

  it('hides the island image when it fails to load', async () => {
    const wrapper = mountMap('tablet')

    const img = wrapper.get('img')
    expect(img.attributes('alt')).not.toBe('')
    await img.trigger('error')

    expect(wrapper.find('img').exists()).toBe(false)
  })
})
