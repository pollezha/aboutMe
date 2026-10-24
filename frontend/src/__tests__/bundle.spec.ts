// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import { build } from 'vite'

// @types/node is not a project dependency, so fs is typed locally and imported by a non-literal specifier.
type Fs = { readFileSync(path: URL, encoding: 'utf8'): string }
const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as Fs

interface ManifestChunk {
  file: string
  src?: string
  isEntry?: boolean
  imports?: string[]
  dynamicImports?: string[]
  css?: string[]
}
type Manifest = Record<string, ManifestChunk>

const frontendRoot = new URL('../../', import.meta.url)
const outDir = new URL('node_modules/.tmp/bundle-build/', frontendRoot)

function toPath(url: URL): string {
  return decodeURIComponent(url.pathname).replace(/^\/([A-Za-z]:)/, '$1')
}

/** Чанки, которые грузятся статически вместе с ключом (сам ключ + его imports, рекурсивно). */
function staticClosure(manifest: Manifest, key: string, seen = new Set<string>()): Set<string> {
  if (seen.has(key)) return seen
  seen.add(key)
  for (const next of manifest[key]?.imports ?? []) staticClosure(manifest, next, seen)
  return seen
}

/** Сигнатура three.js в минифицированном коде: строки предупреждений рендерера не минифицируются. */
const THREE_SIGNATURE = /THREE\.WebGLRenderer/

describe('bundle split (design §4, spec T3)', () => {
  let manifest: Manifest = {}
  const code = (key: string) => fs.readFileSync(new URL(manifest[key]!.file, outDir), 'utf8')

  beforeAll(async () => {
    await build({
      root: toPath(frontendRoot),
      logLevel: 'silent',
      build: { outDir: toPath(outDir), emptyOutDir: true, manifest: true },
    })
    manifest = JSON.parse(fs.readFileSync(new URL('.vite/manifest.json', outDir), 'utf8'))
  }, 120_000)

  it('keeps three.js out of everything the entry loads statically', () => {
    const entry = Object.keys(manifest).find((key) => manifest[key]!.isEntry)
    expect(entry).toBe('index.html')

    for (const key of staticClosure(manifest, entry!)) {
      expect(code(key), `${key} → ${manifest[key]!.file}`).not.toMatch(THREE_SIGNATURE)
    }
  })

  it('loads the scene (with three.js) as a dynamic chunk of the entry', () => {
    expect(manifest['index.html']!.dynamicImports).toContain('src/scene/Scene.vue')

    const sceneChunks = [...staticClosure(manifest, 'src/scene/Scene.vue')]
    expect(sceneChunks.some((key) => THREE_SIGNATURE.test(code(key)))).toBe(true)
  })
  // T12b: Vue devtools (через @tresjs/core) и FPS-мониторы stats-gl/stats.js (через @tresjs/cientos) в проде не
  // нужны, а это ~30 КБ gzip чанка сцены — на критическом пути scene_ready.
  it('ships no Vue devtools or FPS monitors in the scene chunk', () => {
    // Вход (index.html) исключён: эта сборка идёт под NODE_ENV=test, и в main-чанке dev-рантайм Vue с хуками devtools.
    const sceneOwn = [...staticClosure(manifest, 'src/scene/Scene.vue')].filter(
      (key) => key !== 'index.html',
    )
    for (const key of sceneOwn) {
      expect(/__VUE_DEVTOOLS_|stats-gl/.test(code(key)), `${key} → ${manifest[key]!.file}`).toBe(
        false,
      )
    }
  })

  it('preloads the scene chunk from the HTML head, before the entry script (desktop only, see scene/preload)', () => {
    const scene = manifest['src/scene/Scene.vue']!
    const html = fs.readFileSync(new URL('index.html', outDir), 'utf8')
    const preload = html.indexOf(`"/${scene.file}"`)
    expect(preload, 'scene chunk URL in an inline <head> script').toBeGreaterThan(0)
    for (const css of scene.css ?? []) expect(html).toContain(`"/${css}"`)
    expect(preload).toBeLessThan(html.indexOf('<script type="module"'))
  })
})
