import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { nextTick } from 'vue'
import { useUiStore } from '../../stores/ui'
import StaticMap from '../StaticMap.vue'
import source from '../StaticMap.vue?raw'

let pinia: Pinia

beforeEach(() => {
  localStorage.clear()
  pinia = createPinia()
  setActivePinia(pinia)
})

function mountMap(variant: 'tablet' | 'phone' = 'tablet') {
  return mount(StaticMap, { props: { variant }, global: { plugins: [pinia] } })
}

describe('StaticMap', () => {
  it('renders seven hotspot buttons named with the stop number and chapter', () => {
    const wrapper = mountMap()

    const hotspots = wrapper.findAll('button.hotspot')
    expect(hotspots).toHaveLength(7)
    expect(hotspots.map((h) => h.attributes('aria-label'))).toEqual([
      '01 Profile · About me',
      '02 ProSpace · Latest role',
      '03 TimePath · Previous role',
      '04 Tech stack · Skills',
      '05 Education · HSE University',
      '06 Contact · Your team',
      'Monitoring · this site, live',
    ])
  })

  it('emits open with the chapter id on click', async () => {
    const wrapper = mountMap('phone')

    await wrapper.get('button[aria-label="02 ProSpace · Latest role"]').trigger('click')

    expect(wrapper.emitted('open')).toEqual([['prospace']])
  })

  it('places hotspots in percent of the map box from figma-2d-map.json', () => {
    const wrapper = mountMap()

    const style = wrapper.get('button[aria-label="02 ProSpace · Latest role"]').attributes('style')
    expect(style).toContain('left: 71.4%')
    expect(style).toContain('top: 39.6%')
    expect(style).toContain('width: 11.4%')
    expect(style).toContain('height: 9.9%')
  })

  it('uses the variant aspect ratio', () => {
    expect(mountMap().classes()).toContain('static-map--tablet')
    expect(source).toMatch(/\.static-map--tablet\s*\{[^}]*aspect-ratio:\s*736\s*\/\s*666/)
    expect(source).toMatch(/\.static-map--phone\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/)
  })

  it('shows the island render of the current theme, 1x and 2x', async () => {
    const wrapper = mountMap()
    const ui = useUiStore()

    const img = wrapper.get('img')
    expect(img.attributes('src')).toBe('/img/island-day.webp')
    expect(img.attributes('srcset')).toBe('/img/island-day.webp 1x, /img/island-day@2x.webp 2x')

    ui.setTheme('night')
    await nextTick()

    expect(wrapper.get('img').attributes('src')).toBe('/img/island-night.webp')
    expect(wrapper.get('img').attributes('srcset')).toContain('/img/island-night@2x.webp 2x')
  })

  it('loads the render as the LCP image without layout shift', () => {
    const img = mountMap().get('img')

    expect(img.attributes('fetchpriority')).toBe('high')
    expect(img.attributes('decoding')).toBe('async')
    expect(img.attributes('width')).toBe('1200')
    expect(img.attributes('height')).toBe('1086')
  })

  it('shows a numbered pin in the chapter colour on route hotspots', () => {
    const wrapper = mountMap()

    const pin = wrapper.get('button[aria-label="04 Tech stack · Skills"] .pin')
    expect(pin.text()).toBe('04')
    expect(pin.attributes('style')).toContain('--chapter-techstack')
  })

  it('draws the pin number and dot in the per-theme --pin-ink-<chapter> token', () => {
    const wrapper = mountMap()

    const pin = wrapper.get('button[aria-label="02 ProSpace · Latest role"] .pin')
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
    const wrapper = mountMap()

    const img = wrapper.get('img')
    expect(img.attributes('alt')).not.toBe('')
    await img.trigger('error')

    expect(wrapper.find('img').exists()).toBe(false)
  })
})
