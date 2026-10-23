// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import { build } from 'vite-ssg/node'
import { contentFor } from '../content/bundles'
import { CHAPTERS } from '../content/chapters'
import { resolveChapter } from '../content/format'
import { langOf } from '../router'
import { palette } from '../theme/palette'

// @types/node is not a project dependency, so fs is typed locally and imported by a non-literal specifier.
type Fs = {
  readFileSync(path: URL): Uint8Array
  readFileSync(path: URL, encoding: 'utf8'): string
  existsSync(path: URL): boolean
}
const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as Fs

const frontendRoot = new URL('../../', import.meta.url)
const publicDir = new URL('public/', frontendRoot)
const outDir = new URL('node_modules/.tmp/seo-build/', frontendRoot)

/** file: URL → filesystem path that Vite accepts on Windows and POSIX. */
function toPath(url: URL): string {
  return decodeURIComponent(url.pathname).replace(/^\/([A-Za-z]:)/, '$1')
}

/** Width and height from the IHDR chunk (bytes 16..23 of a PNG). */
function pngSize(file: URL): { width: number; height: number } {
  const bytes = fs.readFileSync(file)
  expect(Array.from(bytes.subarray(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  expect(new TextDecoder().decode(bytes.subarray(12, 16))).toBe('IHDR')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

function attr(html: string, pattern: RegExp): string | undefined {
  return html.match(pattern)?.[1]
}

/** Built page; whitespace collapsed so attributes match in order. */
function page(file: string): string {
  return fs.readFileSync(new URL(file, outDir), 'utf8').replace(/\s+/g, ' ')
}

// The same build as `npm run build` (vite-ssg: client + server pass, prerender of every route).
beforeAll(async () => {
  await build(
    {},
    { root: toPath(frontendRoot), logLevel: 'silent', build: { outDir: toPath(outDir) } },
  )
}, 180_000)

describe('built index.html (FR11, D12)', () => {
  let html = ''

  beforeAll(() => {
    html = page('index.html')
  })

  it('has a descriptive title and a description of at most 160 characters', () => {
    expect(attr(html, /<title>([^<]+)<\/title>/)).toBe('Yakov Polezhaev — .NET Backend Developer')
    const description = attr(html, /<meta name="description" content="([^"]+)"/) ?? ''
    expect(description).toContain('.NET Backend Developer')
    expect(description).toContain('Open to work')
    expect(description.length).toBeLessThanOrEqual(160)
  })

  it('has Open Graph and Twitter card tags pointing at the 1200×630 image', () => {
    expect(attr(html, /<meta property="og:title" content="([^"]+)"/)).toContain('Yakov Polezhaev')
    expect(attr(html, /<meta property="og:description" content="([^"]+)"/)).toBeTruthy()
    expect(attr(html, /<meta property="og:type" content="([^"]+)"/)).toBe('website')
    expect(attr(html, /<meta property="og:image" content="([^"]+)"/)).toBe('/og.png')
    expect(attr(html, /<meta property="og:image:width" content="([^"]+)"/)).toBe('1200')
    expect(attr(html, /<meta property="og:image:height" content="([^"]+)"/)).toBe('630')
    expect(attr(html, /<meta name="twitter:card" content="([^"]+)"/)).toBe('summary_large_image')
    expect(attr(html, /<meta name="twitter:title" content="([^"]+)"/)).toContain('Yakov Polezhaev')
    expect(attr(html, /<meta name="twitter:description" content="([^"]+)"/)).toBeTruthy()
    expect(attr(html, /<meta name="twitter:image" content="([^"]+)"/)).toBe('/og.png')
  })

  it('links the favicon, touch icon, manifest and one theme-color the app keeps in sync', () => {
    expect(html).toMatch(/<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml"/)
    expect(html).toMatch(/<link rel="apple-touch-icon" href="\/favicon-192\.png"/)
    expect(html).toMatch(/<link rel="manifest" href="\/site\.webmanifest"/)
    // Тема сайта не следует prefers-color-scheme: applyTheme обновляет этот тег (src/stores/ui.ts).
    expect(html.match(/<meta name="theme-color"/g)).toHaveLength(1)
    expect(html).toMatch(
      `<meta name="theme-color" id="theme-color" content="${palette.day['bg/canvas']}"`,
    )
  })

  it('lets the layout reach under the notch and home indicator', () => {
    expect(attr(html, /<meta name="viewport" content="([^"]+)"/)).toBe(
      'width=device-width, initial-scale=1, viewport-fit=cover',
    )
  })

  it('sets a relative canonical and no og:url until the domain is chosen (VITE_SITE_ORIGIN, T13)', () => {
    expect(html).toMatch(/<link rel="canonical" href="\/">/)
    expect(html).not.toMatch(/property="og:url"/)
  })

  it('sets the theme in an inline script before any stylesheet, without flashing day on night', () => {
    const boot = html.indexOf('aboutme.theme')
    const firstStyle = html.search(/<link rel="stylesheet"|<style/)
    expect(boot).toBeGreaterThan(html.indexOf('id="theme-color"'))
    expect(firstStyle).toBeGreaterThan(boot)
  })

  it('ships the icons, manifest and OG image', () => {
    for (const file of [
      'og.png',
      'favicon.svg',
      'favicon-192.png',
      'favicon-512.png',
      'site.webmanifest',
    ]) {
      expect(fs.existsSync(new URL(file, outDir)), file).toBe(true)
    }
  })
})

// TC-11: without JS (curl) both pages carry every chapter, title, description, OG and hreflang.
describe.each([
  ['/', 'index.html'],
  ['/ru/', 'ru/index.html'],
])('prerendered %s (TC-11)', (path, file) => {
  const content = contentFor(langOf(path))
  let html = ''

  beforeAll(() => {
    html = page(file)
  })

  it('has the heading of every chapter, all windows closed', () => {
    for (const { id } of CHAPTERS) {
      const title = resolveChapter(content, id)
        .title.replace(/&/g, '&amp;')
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      expect(html, id).toMatch(new RegExp(`<h2[^>]*>${title}</h2>`))
    }
    expect(html).not.toMatch(/<dialog[^>]*\sopen/)
  })

  it('has title, description, Open Graph and <html lang> of its content', () => {
    expect(html).toContain(`<title>${content.profile.name} — ${content.profile.role}</title>`)
    expect(html).toMatch(/<meta name="description" content="[^"]+">/)
    expect(html).toMatch(/<meta property="og:title" content="[^"]+">/)
    expect(html).toMatch(new RegExp(`<html lang="${content.lang}"`))
  })

  it('links the language versions with hreflang and x-default → /', () => {
    expect(html).toContain('<link rel="alternate" hreflang="en" href="/">')
    expect(html).toContain('<link rel="alternate" hreflang="x-default" href="/">')
  })
})

describe('public assets', () => {
  it('og.png is 1200×630', () => {
    expect(pngSize(new URL('og.png', publicDir))).toEqual({ width: 1200, height: 630 })
  })

  it('favicon PNGs are 192×192 and 512×512', () => {
    expect(pngSize(new URL('favicon-192.png', publicDir))).toEqual({ width: 192, height: 192 })
    expect(pngSize(new URL('favicon-512.png', publicDir))).toEqual({ width: 512, height: 512 })
  })

  it('site.webmanifest names the site and lists both icons', () => {
    const manifest = JSON.parse(
      fs.readFileSync(new URL('site.webmanifest', publicDir), 'utf8'),
    ) as {
      name: string
      short_name: string
      theme_color: string
      background_color: string
      icons: { src: string; sizes: string; type: string }[]
    }
    expect(manifest.name).toContain('Yakov Polezhaev')
    expect(manifest.short_name).toBe('Yakov Polezhaev')
    expect(manifest.theme_color).toBe('#FFD23F')
    expect(manifest.background_color).toBe('#5FB8E6')
    expect(manifest.icons.map((icon) => [icon.src, icon.sizes, icon.type])).toEqual([
      ['/favicon-192.png', '192x192', 'image/png'],
      ['/favicon-512.png', '512x512', 'image/png'],
    ])
  })
})
