import { describe, expect, it } from 'vitest'

// Все компоненты вне 3D-сцены (у сцены свои цвета из палитры), где бы они ни лежали.
const sources = import.meta.glob<string>(['../**/*.vue', '!../scene/**', '!**/__tests__/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
})
const files = Object.keys(sources)

// Число .vue вне scene/ на момент M2 (этап 3b): переезд файлов не должен молча сузить проверку.
const MIN_FILES = 35

function byName(name: string): string {
  const file = files.find((f) => f.endsWith(`/${name}`))
  if (file === undefined) throw new Error(`missing ${name}`)
  return file
}

function styleFor(file: string): string {
  const source = sources[file]
  if (source === undefined) throw new Error(`missing ${file}`)
  return [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n')
}

describe('ui components use design tokens only', () => {
  it('finds the ui components', () => {
    expect(files.length).toBeGreaterThanOrEqual(MIN_FILES)
  })

  it.each(files)('%s has no raw colours in <style>', (file) => {
    const css = styleFor(file)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(css).not.toMatch(/rgba?\(/)
    expect(css).not.toMatch(/hsla?\(/)
  })

  it.each(files)('%s takes border-radius from --radius-* tokens', (file) => {
    for (const m of styleFor(file).matchAll(/border-radius:\s*([^;]+);/g)) {
      expect(m[1]).toMatch(/^var\(--radius-/)
    }
  })

  it.each(['BaseButton.vue', 'IconButton.vue'])(
    '%s styles :focus-visible with --focus-ring',
    (name) => {
      expect(styleFor(byName(name))).toMatch(/:focus-visible\s*\{[^}]*var\(--focus-ring\)/)
    },
  )
})
