import { describe, expect, it } from 'vitest'
import { bootScript } from '../boot'
import { palette } from '../palette'

const COLORS = {
  day: palette.day['bg/canvas'],
  evening: palette.evening['bg/canvas'],
  night: palette.night['bg/canvas'],
}

interface Visit {
  path?: string
  search?: string
  hash?: string
  storage?: Record<string, string>
  language?: string
  storageThrows?: boolean
}

/** Выполняет именно строку, которая уходит в <head>: она не должна ссылаться на модуль. */
function run(visit: Visit = {}) {
  const root = { dataset: { theme: 'day' } as Record<string, string>, style: { colorScheme: '' } }
  const themeColor: { content: string } = { content: COLORS.day }
  const replaced: string[] = []
  const win = {
    document: {
      documentElement: root,
      getElementById: (id: string) =>
        id === 'theme-color'
          ? { setAttribute: (_: string, value: string) => (themeColor.content = value) }
          : null,
    },
    localStorage: {
      getItem(key: string) {
        if (visit.storageThrows) throw new Error('SecurityError')
        return visit.storage?.[key] ?? null
      },
    },
    location: {
      pathname: visit.path ?? '/',
      search: visit.search ?? '',
      hash: visit.hash ?? '',
      replace: (url: string) => replaced.push(url),
    },
    navigator: { language: visit.language ?? 'en-US' },
  }
  new Function('window', bootScript(COLORS))(win)
  return { theme: root.dataset.theme, scheme: root.style.colorScheme, themeColor, replaced }
}

describe('inline boot script (theme and language before CSS)', () => {
  it('applies the saved theme, color-scheme and theme-color', () => {
    expect(run({ storage: { 'aboutme.theme': 'night' } })).toMatchObject({
      theme: 'night',
      scheme: 'dark',
      themeColor: { content: COLORS.night },
    })
  })

  it('falls back to day for a missing or unknown theme', () => {
    expect(run()).toMatchObject({ theme: 'day', scheme: 'light' })
    expect(run({ storage: { 'aboutme.theme': 'sepia' } })).toMatchObject({
      theme: 'day',
      themeColor: { content: COLORS.day },
    })
  })

  it('lets ?theme= preview a theme over the saved one', () => {
    expect(run({ search: '?theme=evening', storage: { 'aboutme.theme': 'night' } })).toMatchObject({
      theme: 'evening',
      themeColor: { content: COLORS.evening },
    })
  })

  it('sends a first-time Russian browser to /ru/, keeping query and hash', () => {
    expect(run({ language: 'ru-RU', search: '?theme=night', hash: '#prospace' }).replaced).toEqual([
      '/ru/?theme=night#prospace',
    ])
  })

  it('follows a saved RU choice from /', () => {
    expect(run({ storage: { 'aboutme.lang': 'ru' } }).replaced).toEqual(['/ru/'])
  })

  it('stays put when English was chosen, the browser is not Russian, or already on /ru/', () => {
    expect(run({ language: 'ru-RU', storage: { 'aboutme.lang': 'en' } }).replaced).toEqual([])
    expect(run({ language: 'en-GB' }).replaced).toEqual([])
    expect(run({ language: 'ru', path: '/ru/' }).replaced).toEqual([])
    expect(run({ language: 'ru', path: '/ru' }).replaced).toEqual([])
  })

  it('survives a blocked localStorage with the defaults', () => {
    expect(run({ storageThrows: true, language: 'ru-RU' })).toMatchObject({
      theme: 'day',
      replaced: [],
    })
  })
})
