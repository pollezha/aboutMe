import { describe, expect, it } from 'vitest'
import { scenePreloadScript } from '../preload'
import { MIN_3D_MEMORY_GB, MIN_3D_WIDTH } from '../thresholds'

const URLS = ['/assets/Scene-abc.js', '/assets/Scene-abc.css']

interface Visit {
  width?: number
  webgl2?: boolean
  deviceMemory?: number
  search?: string
  storage?: Record<string, string>
  storageThrows?: boolean
  noMatchMedia?: boolean
}

interface Link {
  rel: string
  href: string
  as?: string
  crossOrigin?: string | null
}

/** Выполняет именно строку, которая уходит в <head>: она не должна ссылаться на модуль. */
function run(visit: Visit = {}): Link[] {
  const head: Link[] = []
  const win = {
    location: { search: visit.search ?? '' },
    localStorage: {
      getItem(key: string) {
        if (visit.storageThrows) throw new Error('SecurityError')
        return visit.storage?.[key] ?? null
      },
    },
    matchMedia: visit.noMatchMedia
      ? undefined
      : (query: string) => {
          const min = Number(/min-width:\s*(\d+)px/.exec(query)?.[1])
          return { matches: (visit.width ?? 1280) >= min }
        },
    navigator: { deviceMemory: visit.deviceMemory },
    WebGL2RenderingContext: visit.webgl2 === false ? undefined : function WebGL2() {},
    document: {
      createElement: () => ({ rel: '', href: '' }) as Link,
      head: { appendChild: (link: Link) => head.push(link) },
    },
  }
  const limits = { minWidth: MIN_3D_WIDTH, minMemory: MIN_3D_MEMORY_GB }
  new Function('window', scenePreloadScript(URLS, limits))(win)
  return head
}

describe('scene chunk preload in <head> (desktop with WebGL2 only)', () => {
  it('preloads the scene module and its styles on a wide screen with WebGL2', () => {
    expect(run()).toEqual([
      { rel: 'modulepreload', href: '/assets/Scene-abc.js', crossOrigin: '' },
      { rel: 'preload', as: 'style', href: '/assets/Scene-abc.css', crossOrigin: '' },
    ])
  })

  it('skips phones and narrow windows (< 768 px): 4G should not pay for the scene', () => {
    expect(run({ width: 767 })).toEqual([])
    expect(run({ width: 390 })).toEqual([])
    expect(run({ noMatchMedia: true })).toEqual([])
  })

  it('skips browsers without WebGL2 and devices with little memory', () => {
    expect(run({ webgl2: false })).toEqual([])
    expect(run({ deviceMemory: 2 })).toEqual([])
    expect(run({ deviceMemory: 8 })).toHaveLength(2)
  })

  it('respects the remembered 2D choice and ?mode=2d, but ?mode=3d wins over the saved choice', () => {
    expect(run({ storage: { 'aboutme.sceneChoice': '2d' } })).toEqual([])
    expect(run({ search: '?mode=2d' })).toEqual([])
    expect(run({ search: '?mode=3d', storage: { 'aboutme.sceneChoice': '2d' } })).toHaveLength(2)
  })

  it('survives a blocked localStorage', () => {
    expect(run({ storageThrows: true })).toHaveLength(2)
  })
})
