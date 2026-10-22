import { describe, expect, it } from 'vitest'

const sources = import.meta.glob<string>(
  ['../**/*.vue', '../../fallback2d/**/*.vue', '../../App.vue'],
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
)
const files = Object.keys(sources)

function styleFor(file: string): string {
  const source = sources[file]
  if (source === undefined) throw new Error(`missing ${file}`)
  return [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n')
}

describe('ui components use design tokens only', () => {
  it('finds the ui components', () => {
    expect(files.length).toBeGreaterThanOrEqual(5)
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

  it.each(['../BaseButton.vue', '../IconButton.vue'])(
    '%s styles :focus-visible with --focus-ring',
    (file) => {
      expect(styleFor(file)).toMatch(/:focus-visible\s*\{[^}]*var\(--focus-ring\)/)
    },
  )
})
