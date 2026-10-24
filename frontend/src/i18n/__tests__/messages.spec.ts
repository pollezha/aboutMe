import { describe, expect, it } from 'vitest'
import { CHAPTERS, ROUTE } from '../../content/chapters'
import { createAppI18n } from '..'
import en from '../en.json'
import ru from '../ru.json'

type Messages = { [key: string]: string | Messages }

function keys(messages: Messages, prefix = ''): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : keys(value, `${prefix}${key}.`),
  )
}

function lookup(messages: Messages, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], messages)
}

describe('i18n messages', () => {
  it('has the same keys in English and Russian', () => {
    expect(keys(ru).sort()).toEqual(keys(en).sort())
  })

  // Сборка без компилятора сообщений vue-i18n (vite.config, T12b): строки выводятся как написаны, подставляются
  // только {name} — ни `@`, ни `|`, ни апострофы не должны превращаться в синтаксис.
  it('renders every message verbatim, substituting only {name} placeholders', () => {
    for (const [lang, messages] of [
      ['en', en],
      ['ru', ru],
    ] as const) {
      const { t } = createAppI18n(lang).global
      for (const key of keys(messages)) {
        const raw = lookup(messages, key) as string
        const names = [...raw.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!)
        const values = Object.fromEntries(names.map((name) => [name, `<${name}>`]))
        const expected = raw.replace(/\{(\w+)\}/g, (_, name: string) => `<${name}>`)
        expect(t(key, values), `${lang}:${key}`).toBe(expected)
      }
    }
    expect(createAppI18n('en').global.t('window.stop', { n: 2, total: 6 })).toBe('Stop 2 of 6')
  })

  it('has no empty strings', () => {
    for (const messages of [en, ru]) {
      for (const key of keys(messages)) expect(lookup(messages, key), key).not.toBe('')
    }
  })

  it('names every chapter with a title and a subtitle in both languages', () => {
    for (const messages of [en, ru]) {
      for (const { id } of CHAPTERS) {
        expect(typeof lookup(messages, `chapters.${id}.title`), id).toBe('string')
        expect(typeof lookup(messages, `chapters.${id}.subtitle`), id).toBe('string')
      }
    }
  })

  // UX16: подпись остановки в баре — не длиннее 14 символов (перенос, а не усечение).
  it('keeps route stop captions within 14 characters', () => {
    for (const messages of [en, ru]) {
      for (const { id } of ROUTE) {
        for (const part of ['title', 'subtitle']) {
          const text = lookup(messages, `chapters.${id}.${part}`) as string
          expect(text.length, `${id}.${part}: ${text}`).toBeLessThanOrEqual(14)
        }
      }
    }
  })
})

// Строки интерфейса — только через i18n: в шаблонах и скриптах компонентов нет известных
// английских подписей (проверка по списку, а не полный разбор шаблонов).
const UI_WORDS = [
  'Contact',
  'Monitoring',
  'Rotate map',
  'Pause animation',
  'Continue without 3D',
  'Loading the 3D island',
  'The map works without it',
  "3D scene didn't load",
  'Dismiss',
  'Close',
  'Next',
  'Proof & links',
  'Theme',
  'Language',
  'Chapters',
  'Switch to',
  'CV (PDF)',
  'Isometric island',
  'About me',
  'Latest role',
  'Previous role',
  'Your team',
  'offline',
]

const sources = import.meta.glob<string>(
  ['../../App.vue', '../../ui/**/*.vue', '../../fallback2d/**/*.vue', '../../scene/Labels.vue'],
  { query: '?raw', import: 'default', eager: true },
)

function withoutComments(source: string): string {
  return source
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

describe('UI strings', () => {
  const files = Object.keys(sources)

  it('finds the components', () => {
    expect(files.length).toBeGreaterThanOrEqual(20)
  })

  it.each(files)('%s has no English UI literals outside i18n', (file) => {
    const source = withoutComments(sources[file] ?? '')
    const found = UI_WORDS.filter((word) => {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(`(['"\`]|>\\s*)${escaped}`).test(source)
    })
    expect(found).toEqual([])
  })
})
