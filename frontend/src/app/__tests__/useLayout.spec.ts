import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import type { Mode } from '../../mode'
import type { Breakpoint } from '../../shared/lib'
import { useLayout } from '../useLayout'

function layoutFor(mode: Mode, breakpoint: Breakpoint) {
  return useLayout(ref(mode), ref(breakpoint))
}

describe('useLayout', () => {
  it('lays the HTML over the 3D scene on a laptop', () => {
    const { layout, heroVariant, barVariant } = layoutFor('3d', 'laptop')

    expect(layout.value).toBe('overlay')
    expect(heroVariant.value).toBe('laptop')
    expect(barVariant.value).toBe('compact')
  })

  it('stacks the 2D map on a desktop', () => {
    const { layout, heroVariant, barVariant, mapVariant } = layoutFor('2d', 'desktop')

    expect(layout.value).toBe('stacked')
    expect(heroVariant.value).toBe('desktop')
    expect(barVariant.value).toBe('compact')
    expect(mapVariant.value).toBe('tablet')
  })

  it('uses the desktop bar only over the 3D scene on a desktop', () => {
    const { layout, barVariant } = layoutFor('3d', 'desktop')

    expect(layout.value).toBe('overlay')
    expect(barVariant.value).toBe('desktop')
  })

  it('stacks the phone layout even in 3D and leaves the bar to its media query', () => {
    const { layout, heroVariant, barVariant, mapVariant } = layoutFor('3d', 'mobile')

    expect(layout.value).toBe('stacked')
    expect(heroVariant.value).toBe('mobile')
    expect(barVariant.value).toBeUndefined()
    expect(mapVariant.value).toBe('phone')
  })

  it('follows mode changes', () => {
    const mode = ref<Mode>('3d')
    const { layout } = useLayout(mode, ref<Breakpoint>('laptop'))
    expect(layout.value).toBe('overlay')

    mode.value = '2d'

    expect(layout.value).toBe('stacked')
  })
})
