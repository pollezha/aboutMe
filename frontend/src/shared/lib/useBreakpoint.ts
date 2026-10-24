import { onBeforeUnmount, readonly, ref } from 'vue'

// Брейкпоинты Figma (D1): ≥ 1366 desktop (Desktop 1440), 1280–1365 laptop (Laptop 1280×720),
// 768–1279 tablet (Tablet 768), < 768 mobile (Phone 390).
export type Breakpoint = 'desktop' | 'laptop' | 'tablet' | 'mobile'

const QUERIES: [Breakpoint, string][] = [
  ['desktop', '(min-width: 1366px)'],
  ['laptop', '(min-width: 1280px)'],
  ['tablet', '(min-width: 768px)'],
]
const MIN_WIDTH: Record<Exclude<Breakpoint, 'mobile'>, number> = {
  desktop: 1366,
  laptop: 1280,
  tablet: 768,
}

function current(lists: [Breakpoint, MediaQueryList][] | null): Breakpoint {
  if (lists) return lists.find(([, list]) => list.matches)?.[0] ?? 'mobile'
  const width = typeof window !== 'undefined' ? window.innerWidth : MIN_WIDTH.desktop
  return (
    QUERIES.find(([name]) => width >= MIN_WIDTH[name as keyof typeof MIN_WIDTH])?.[0] ?? 'mobile'
  )
}

export function useBreakpoint() {
  const lists =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? QUERIES.map(
          ([name, query]) => [name, window.matchMedia(query)] as [Breakpoint, MediaQueryList],
        )
      : null
  const breakpoint = ref<Breakpoint>(current(lists))

  const update = () => {
    breakpoint.value = current(lists)
  }
  lists?.forEach(([, list]) => list.addEventListener('change', update))
  onBeforeUnmount(() => lists?.forEach(([, list]) => list.removeEventListener('change', update)))

  return readonly(breakpoint)
}
