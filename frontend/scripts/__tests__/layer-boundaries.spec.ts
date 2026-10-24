// @vitest-environment node
import { readdirSync } from 'node:fs'
import { ESLint } from 'eslint'
import { beforeAll, describe, expect, it } from 'vitest'
import { findCycle, MODULES, moduleBoundaries, unregisteredFolders } from '../module-graph.mjs'

// Границы слоёв фронта задаёт eslint.config.js (no-restricted-imports + no-restricted-syntax для import()).
// Линтим строку от имени файла внутри слоя: файл не обязан существовать, важен только путь.
const eslint = new ESLint()

async function boundaryErrors(filePath: string, code: string, linter = eslint): Promise<string[]> {
  const [result] = await linter.lintText(code, { filePath })
  return (result?.messages ?? [])
    .filter((m) => m.ruleId === 'no-restricted-imports' || m.ruleId === 'no-restricted-syntax')
    .map((m) => m.message)
}

describe('frontend layer boundaries', () => {
  // Первый вызов грузит конфиг и плагины (vue, typescript-eslint) — под нагрузкой полного прогона это секунды.
  beforeAll(() => eslint.lintText('', { filePath: 'src/fallback2d/Fixture.ts' }), 30_000)

  it('forbids the 2D fallback from importing the 3D scene', async () => {
    const errors = await boundaryErrors(
      'src/fallback2d/Fixture.ts',
      "import { layout } from '../scene/layout'\nexport const x = layout\n",
    )
    expect(errors).toHaveLength(1)
  })

  it('forbids the 2D fallback from importing three.js and TresJS', async () => {
    const errors = await boundaryErrors(
      'src/fallback2d/Fixture.ts',
      "import { Vector3 } from 'three'\nimport { TresCanvas } from '@tresjs/core'\nexport const x = [Vector3, TresCanvas]\n",
    )
    expect(errors).toHaveLength(2)
  })

  it('forbids a dynamic import of three.js outside the scene', async () => {
    const errors = await boundaryErrors(
      'src/ui/Fixture.ts',
      "export const load = () => import('three')\n",
    )
    expect(errors).toHaveLength(1)
  })

  it('lets the 2D fallback use content and stores', async () => {
    const errors = await boundaryErrors(
      'src/fallback2d/Fixture.ts',
      "import { CHAPTERS } from '../content'\nimport { useUiStore } from '../stores/ui'\nexport const x = [CHAPTERS, useUiStore]\n",
    )
    expect(errors).toEqual([])
  })

  it('lets the lower modules be imported only through their index (M5)', async () => {
    expect(
      await boundaryErrors(
        'src/scene/X.ts',
        "import { palette } from '../theme/palette'\nexport const x = palette\n",
      ),
    ).toHaveLength(1)
    expect(
      await boundaryErrors(
        'src/scene/X.ts',
        "import { palette } from '../theme'\nexport const x = palette\n",
      ),
    ).toEqual([])
    expect(
      await boundaryErrors(
        'src/stores/X.ts',
        "import { ROUTE } from '../content/chapters'\nexport const x = ROUTE\n",
      ),
    ).toHaveLength(1)
    expect(
      await boundaryErrors(
        'src/Fixture.ts',
        "import { contentFor } from './content/bundles'\nimport { load } from './shared/lib/storage'\nimport { contentFor as c, palette } from './content'\nexport const x = [contentFor, load, c, palette]\n",
      ),
    ).toHaveLength(2)
  })

  it('lets main.ts pull theme stylesheets directly', async () => {
    expect(await boundaryErrors('src/main.ts', "import './theme/tokens.css'\n")).toEqual([])
    expect(await boundaryErrors('src/main.ts', "import './theme/boot'\n")).toHaveLength(1)
  })

  it('keeps content below ui, scene and stores', async () => {
    const errors = await boundaryErrors(
      'src/content/Fixture.ts',
      "import { useUiStore } from '../stores/ui'\nimport Icon from '../ui/Icon.vue'\nexport const x = [useUiStore, Icon]\n",
    )
    expect(errors).toHaveLength(2)
  })

  it('forbids stores from importing components', async () => {
    const errors = await boundaryErrors(
      'src/stores/Fixture.ts',
      "import App from '../App.vue'\nexport const x = App\n",
    )
    expect(errors).toHaveLength(1)
  })

  it('lets the app root reach the scene only through the mode module (M6)', async () => {
    const allowed = await boundaryErrors(
      'src/Fixture.ts',
      "import { loadScene, shouldUse3D } from './mode'\nexport const x = [loadScene, shouldUse3D]\n",
    )
    const forbidden = await boundaryErrors(
      'src/Fixture.ts',
      "import Scene from './scene/Scene.vue'\nimport { mapRotation } from './scene'\nexport const x = [Scene, mapRotation]\n",
    )
    expect(allowed).toEqual([])
    expect(forbidden).toHaveLength(2)
  })

  it('lets the upper modules be imported only through their index (M6)', async () => {
    expect(
      await boundaryErrors(
        'src/mode/X.ts',
        "import Scene from '../scene/Scene.vue'\nexport const x = Scene\n",
      ),
    ).toHaveLength(1)
    expect(
      await boundaryErrors(
        'src/app/X.ts',
        "import { mapRotation } from '../scene'\nexport const x = mapRotation\n",
      ),
    ).toHaveLength(1)
    expect(
      await boundaryErrors(
        'src/app/X.ts',
        "import { mapRotation } from '../mode'\nimport { HeroCard } from '../hero'\nexport const x = [mapRotation, HeroCard]\n",
      ),
    ).toEqual([])
    expect(
      await boundaryErrors(
        'src/app/X.ts',
        "import HeroCard from '../hero/HeroCard.vue'\nimport { WINDOWS } from '../chapters/registry'\nexport const x = [HeroCard, WINDOWS]\n",
      ),
    ).toHaveLength(2)
  })
})

// Граф модулей ADR-0007: scripts/module-graph.mjs → записи boundary(). Синтетический граф проверяет каждое
// правило генератора отдельно, без реального дерева src/.
const lintWith = (modules: Parameters<typeof moduleBoundaries>[0]) =>
  new ESLint({ overrideConfigFile: true, overrideConfig: moduleBoundaries(modules) })

describe('module graph rules', () => {
  const graph = lintWith({
    route: { deps: [], facade: true },
    content: { deps: [], facade: false },
    hero: { deps: ['route', 'content'], facade: true },
    chapters: { deps: [], facade: true, prerendered: true },
    scene: { deps: [], facade: true, lazy: true },
    mode: { deps: ['scene'], facade: true },
    'shared/lib': { deps: [], facade: true },
    'shared/ui': { deps: [], facade: true },
  })
  const errors = (filePath: string, code: string) => boundaryErrors(filePath, code, graph)

  it('allows another module only through its index', async () => {
    expect(
      await errors('src/hero/X.ts', "export { a } from '../route/useRouteStore'\n"),
    ).toHaveLength(1)
    expect(await errors('src/hero/X.ts', "export { a } from '../route'\n")).toEqual([])
  })

  it('lets deep imports through while the module has no facade yet', async () => {
    expect(await errors('src/hero/X.ts', "export { a } from '../content/chapters'\n")).toEqual([])
  })

  it('treats ./<name> as a file of the same module, not as another module', async () => {
    expect(await errors('src/content/X.ts', "export { a } from './chapters'\n")).toEqual([])
  })

  it('forbids an arrow that is not in the graph', async () => {
    expect(await errors('src/route/X.ts', "export { a } from '../hero'\n")).toHaveLength(1)
    expect(await errors('src/shared/ui/X.ts', "export { a } from '../lib'\n")).toHaveLength(1)
  })

  it('forbids import() in prerendered modules', async () => {
    expect(
      await errors('src/chapters/X.ts', "export const a = () => import('./B.vue')\n"),
    ).toHaveLength(1)
  })

  it('keeps three.js in the lazy module and its import() in the lazy index', async () => {
    expect(await errors('src/route/X.ts', "export { Vector3 } from 'three'\n")).toHaveLength(1)
    expect(await errors('src/scene/X.ts', "export { Vector3 } from 'three'\n")).toEqual([])
    expect(
      await errors('src/mode/X.ts', "export const a = () => import('../scene/A.vue')\n"),
    ).toHaveLength(1)
    expect(
      await errors('src/scene/index.ts', "export const a = () => import('./A.vue')\n"),
    ).toEqual([])
    expect(
      await errors('src/scene/index.ts', "import A from './A.vue'\nexport const a = A\n"),
    ).toHaveLength(1)
  })

  it('finds a cycle and accepts the real graph', () => {
    const cyclic = { a: { deps: ['b'], facade: false }, b: { deps: ['a'], facade: false } }
    expect(findCycle(cyclic)).toEqual(['a', 'b', 'a'])
    expect(findCycle(MODULES)).toBeNull()
  })

  it('names every folder of src/ that is not in the graph', () => {
    expect(unregisteredFolders(MODULES, ['content', 'shared/ui', 'foo'])).toEqual(['foo'])
    const dirs = (path: string) =>
      readdirSync(new URL(`../../${path}`, import.meta.url), { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name !== '__tests__')
        .map((d) => d.name)
    const shared = dirs('src').includes('shared')
      ? dirs('src/shared').map((d) => `shared/${d}`)
      : []
    expect(unregisteredFolders(MODULES, [...dirs('src'), ...shared])).toEqual([])
  })

  it('keeps sub-folder names of a module apart from module names', () => {
    const names = new Set(Object.keys(MODULES).flatMap((key) => key.split('/')))
    const clashes = Object.entries(MODULES)
      .filter(([, m]) => !m.legacy && !m.files)
      .flatMap(([key]) => {
        const root = new URL(`../../src/${key}/`, import.meta.url)
        try {
          return readdirSync(root, { recursive: true, withFileTypes: true })
            .filter((d) => d.isDirectory() && d.name !== '__tests__' && names.has(d.name))
            .map((d) => `${key}: ${d.name}`)
        } catch {
          return []
        }
      })
    expect(clashes).toEqual([])
  })

  it('lists every target module of ADR-0007 with known dependencies only', () => {
    const targets = ['shared/lib', 'shared/ui', 'content', 'theme', 'locale', 'route', 'hero']
    targets.push('chapters', 'windows', 'fallback2d', 'scene', 'mode', 'app')
    expect(Object.keys(MODULES)).toEqual(expect.arrayContaining(targets))
    for (const [name, m] of Object.entries(MODULES)) {
      for (const dep of [...m.deps, ...(m.legacyDeps ?? [])]) {
        expect(Object.keys(MODULES), `${name} → ${dep}`).toContain(dep)
      }
    }
  })

  it.todo('matches the module table in frontend/CLAUDE.md (M18)')
})

describe('max-lines', () => {
  const lines = (n: number) =>
    Array.from({ length: n }, (_, i) => `export const a${i} = ${i}\n`).join('')
  const maxLines = async (filePath: string, code: string) => {
    const [result] = await eslint.lintText(code, { filePath })
    return (result?.messages ?? []).filter((m) => m.ruleId === 'max-lines')
  }

  it('caps a source file at 250 lines of code', async () => {
    expect(await maxLines('src/content/Fixture.ts', lines(250) + '\n\n// comment\n')).toEqual([])
    expect(await maxLines('src/content/Fixture.ts', lines(251))).toHaveLength(1)
  })

  it('skips tests and generated theme files', async () => {
    expect(await maxLines('src/content/__tests__/Fixture.spec.ts', lines(251))).toEqual([])
    expect(await maxLines('src/theme/palette.ts', lines(251))).toEqual([])
  })

  it('counts the whole SFC: template and style lines add up with the script', async () => {
    const sfc = (n: number) =>
      `<script setup lang="ts">\n${lines(n)}</script>\n\n<template><p /></template>\n\n<style scoped>\n${'p { margin: 0; }\n'.repeat(50)}</style>\n`
    expect(await maxLines('src/content/Fixture.vue', sfc(190))).toEqual([])
    expect(await maxLines('src/content/Fixture.vue', sfc(200))).toHaveLength(1)
  })
})
