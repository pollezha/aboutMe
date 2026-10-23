// @vitest-environment node
import { ESLint } from 'eslint'
import { beforeAll, describe, expect, it } from 'vitest'

// Границы слоёв фронта задаёт eslint.config.js (no-restricted-imports + no-restricted-syntax для import()).
// Линтим строку от имени файла внутри слоя: файл не обязан существовать, важен только путь.
const eslint = new ESLint()

async function boundaryErrors(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath })
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

  it('lets the 2D fallback use content, i18n and stores', async () => {
    const errors = await boundaryErrors(
      'src/fallback2d/Fixture.ts',
      "import { chapters } from '../content/chapters'\nimport { useUiStore } from '../stores/ui'\nexport const x = [chapters, useUiStore]\n",
    )
    expect(errors).toEqual([])
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

  it('lets the app root load the scene only through its lazy entry', async () => {
    const allowed = await boundaryErrors(
      'src/Fixture.ts',
      "import { loadSceneWhenIdle } from './scene'\nimport { shouldUse3D } from './scene/shouldUse3D'\nexport const x = [loadSceneWhenIdle, shouldUse3D]\n",
    )
    const forbidden = await boundaryErrors(
      'src/Fixture.ts',
      "import Scene from './scene/Scene.vue'\nexport const x = Scene\n",
    )
    expect(allowed).toEqual([])
    expect(forbidden).toHaveLength(1)
  })
})
