// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import { build } from 'vite'

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

describe('built index.html (FR11, D12)', () => {
  let html = ''

  beforeAll(async () => {
    await build({
      root: toPath(frontendRoot),
      logLevel: 'silent',
      build: { outDir: toPath(outDir), emptyOutDir: true },
    })
    // Prettier wraps long tags over several lines; collapse whitespace so attributes match in order.
    html = fs.readFileSync(new URL('index.html', outDir), 'utf8').replace(/\s+/g, ' ')
  }, 120_000)

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

  it('links the favicon, touch icon, manifest and day/night theme colors', () => {
    expect(html).toMatch(/<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml"/)
    expect(html).toMatch(/<link rel="apple-touch-icon" href="\/favicon-192\.png"/)
    expect(html).toMatch(/<link rel="manifest" href="\/site\.webmanifest"/)
    expect(html).toMatch(/<meta name="theme-color" content="#[0-9A-F]{6}" \/?>/)
    expect(html).toMatch(
      /<meta name="theme-color" content="#[0-9A-F]{6}" media="\(prefers-color-scheme: dark\)"/,
    )
  })

  it('sets no canonical or og:url until the domain is chosen', () => {
    expect(html).not.toMatch(/rel="canonical"/)
    expect(html).not.toMatch(/property="og:url"/)
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
