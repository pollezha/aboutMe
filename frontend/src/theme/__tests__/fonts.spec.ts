// @vitest-environment node
import { describe, expect, it } from 'vitest'
import figmaTokens from '../../../scripts/design/figma-tokens.json'

// @types/node is not a project dependency, so fs is typed locally and imported by a non-literal specifier.
type Fs = {
  readFileSync(path: URL, encoding: 'utf8'): string
  statSync(path: URL): { size: number }
}
const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as Fs

const FONT_BUDGET_BYTES = 150 * 1024
const MIN_FONT_SIZE_PX = 12

const frontendRoot = new URL('../../../', import.meta.url)
const fontsCssUrl = new URL('src/theme/fonts.css', frontendRoot)
const typographyCssUrl = new URL('src/theme/typography.css', frontendRoot)

type TextStyle = {
  family: string
  weight: number
  size: number
  lineHeight: number
  letterSpacing: number
  uppercase?: boolean
}
const textStyles = figmaTokens.textStyles as Record<string, TextStyle>

function resolveSpecifier(spec: string, from: URL): URL {
  if (spec.startsWith('.') || spec.startsWith('/')) return new URL(spec, from)
  return new URL(`node_modules/${spec}`, frontendRoot)
}

function unquote(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, '')
}

function woff2Files(cssUrl: URL, seen = new Set<string>()): Set<string> {
  const css = fs.readFileSync(cssUrl, 'utf8')
  for (const [, spec] of css.matchAll(/@import\s+(?:url\()?\s*(['"][^'"]+['"])/g)) {
    woff2Files(resolveSpecifier(unquote(spec!), cssUrl), seen)
  }
  for (const [, ref] of css.matchAll(/url\(([^)]+)\)/g)) {
    const spec = unquote(ref!)
    if (spec.endsWith('.woff2')) seen.add(resolveSpecifier(spec, cssUrl).href)
  }
  return seen
}

function classBody(css: string, className: string): string | undefined {
  return new RegExp(`\\.${className}\\s*\\{([^}]*)\\}`).exec(css)?.[1]
}

function expectedClassName(styleName: string): string {
  const parts = styleName.split('/').map((part) => part.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
  return `t-${parts.join('-')}`
}

describe('fonts', () => {
  it('self-hosted woff2 files referenced by fonts.css fit the 150 KB budget', () => {
    const files = [...woff2Files(fontsCssUrl)]
    const total = files.reduce((sum, href) => sum + fs.statSync(new URL(href)).size, 0)

    expect(files.length).toBeGreaterThan(0)
    expect(total).toBeLessThanOrEqual(FONT_BUDGET_BYTES)
  })

  it('loads only latin and cyrillic subsets in normal style', () => {
    const files = [...woff2Files(fontsCssUrl)].map((href) => href.split('/').pop())

    for (const file of files) {
      expect(file).toMatch(/-(latin|cyrillic)-(wght|\d00)-normal\.woff2$/)
    }
  })

  it('limits every font face to its subset with unicode-range', () => {
    const faces = [...fs.readFileSync(fontsCssUrl, 'utf8').matchAll(/@font-face\s*\{([^}]*)\}/g)]

    expect(faces.length).toBeGreaterThan(0)
    for (const [, body] of faces) expect(body).toMatch(/unicode-range:/)
  })
})

describe('typography', () => {
  const css = fs.readFileSync(typographyCssUrl, 'utf8')

  it.each(Object.entries(textStyles))('%s has a class with the Figma font size', (name, style) => {
    const className = expectedClassName(name)
    const body = classBody(css, className)

    expect(body, `.${className} is missing`).toBeDefined()
    const family = style.family === 'IBM Plex Mono' ? '--font-mono' : '--font-text'
    const letterSpacing = style.letterSpacing === 0 ? '0' : `${style.letterSpacing}em`
    expect(body).toMatch(new RegExp(`font-size:\\s*${style.size}px\\s*;`))
    expect(body).toMatch(new RegExp(`font-family:\\s*var\\(${family}\\)\\s*;`))
    expect(body).toMatch(new RegExp(`font-weight:\\s*${style.weight}\\s*;`))
    expect(body).toMatch(new RegExp(`line-height:\\s*${style.lineHeight}\\s*;`))
    expect(body).toMatch(new RegExp(`letter-spacing:\\s*${letterSpacing}\\s*;`))
    expect(/text-transform:\s*uppercase/.test(body!)).toBe(style.uppercase === true)
  })

  it('has no font size below 12px', () => {
    const sizes = [...css.matchAll(/font-size:\s*([\d.]+)px/g)].map(([, size]) => Number(size))

    expect(sizes.length).toBeGreaterThan(0)
    for (const size of sizes) expect(size).toBeGreaterThanOrEqual(MIN_FONT_SIZE_PX)
  })

  it('provides a tabular numbers helper', () => {
    expect(classBody(css, 't-tabular')).toMatch(/font-variant-numeric:\s*tabular-nums/)
  })
})
