import { computed, type Ref } from 'vue'
import type { Mode } from '../mode'
import type { Breakpoint } from '../shared/lib'

export type Layout = 'overlay' | 'stacked'

/**
 * Раскладка страницы по режиму и брейкпоинту.
 * overlay — Hero и бар поверх сцены (Figma Desktop 33:2, Laptop 33:246);
 * stacked — колонка TopBar → Hero → карта, бар закреплён внизу (Figma Tablet 34:709, Phone 56:1378).
 */
export function useLayout(mode: Readonly<Ref<Mode>>, breakpoint: Readonly<Ref<Breakpoint>>) {
  const layout = computed<Layout>(() =>
    mode.value === '3d' && (breakpoint.value === 'desktop' || breakpoint.value === 'laptop')
      ? 'overlay'
      : 'stacked',
  )
  const heroVariant = computed(() => {
    if (breakpoint.value === 'mobile') return 'mobile'
    // В колонке на планшете Hero во всю ширину с десктопной типографикой (Figma Tablet 34:709).
    return layout.value === 'overlay' && breakpoint.value === 'laptop' ? 'laptop' : 'desktop'
  })
  const barVariant = computed(() => {
    if (breakpoint.value === 'mobile') return undefined // 2D-бар 72 px (медиа-запрос в BottomBar)
    return breakpoint.value === 'desktop' && layout.value === 'overlay' ? 'desktop' : 'compact'
  })
  const mapVariant = computed(() => (breakpoint.value === 'mobile' ? 'phone' : 'tablet'))

  return { layout, heroVariant, barVariant, mapVariant }
}
