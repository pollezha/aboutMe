import { describe, expect, it } from 'vitest'
import figma from '../../../scripts/design/figma-tokens.json'
import tokensCss from '../tokens.css?raw'
import { contrastRatio } from '../contrast'
import { layout, palette, type SemanticToken, type ThemeName } from '../palette'

const THEMES: ThemeName[] = ['day', 'evening', 'night']
const MODE_OF: Record<ThemeName, 'Day' | 'Evening' | 'Night'> = {
  day: 'Day',
  evening: 'Evening',
  night: 'Night',
}
const semanticEntries = Object.entries(figma.semantic)
const semanticNames = semanticEntries.map(([name]) => name)

// Пары «текст на фоне», заявленные на странице Foundations как ≥ 4.5:1 (NFR3).
const TEXT_ON_BG: [SemanticToken, SemanticToken][] = [
  ['text/primary', 'bg/surface'],
  ['text/primary', 'bg/surface-alt'],
  ['text/secondary', 'bg/surface'],
  ['text/secondary', 'bg/surface-alt'],
  ['text/on-accent', 'accent/primary'],
  ['text/on-dark', 'chapter/techstack'],
]

// knownIssue (Specs §7): текущее значение status/danger на bg/surface в Night.
const KNOWN_NIGHT_DANGER_RATIO = 2.8

/** Объявления `--name: value` из единственного блока `:root` или `:root[data-theme=<theme>]`. */
function declarations(theme?: ThemeName): [string, string][] {
  // Кавычки атрибута для CSS не важны (Prettier ставит одинарные).
  const selector = theme ? `:root\\[data-theme=['"]${theme}['"]\\]` : ':root'
  const blocks = [...tokensCss.matchAll(new RegExp(`(?:^|\\n)${selector} \\{([^}]*)\\}`, 'g'))]
  expect(blocks, `exactly one block for ${theme ?? ':root'}`).toHaveLength(1)
  const body = blocks[0]?.[1] ?? ''
  return [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [
    m[1] ?? '',
    (m[2] ?? '').trim(),
  ])
}

describe('palette.ts matches the Figma snapshot', () => {
  it('has exactly the Semantic names in every theme', () => {
    for (const theme of THEMES) {
      expect(Object.keys(palette[theme])).toEqual(semanticNames)
    }
  })

  it('has the Figma value for every Semantic token and mode', () => {
    for (const theme of THEMES) {
      for (const [name, token] of semanticEntries) {
        expect(palette[theme][name as SemanticToken], `${theme} ${name}`).toBe(
          token[MODE_OF[theme]],
        )
      }
    }
  })

  it('has exactly the Layout names with their css names', () => {
    expect(Object.keys(layout)).toEqual(Object.keys(figma.layout))
    for (const [name, token] of Object.entries(figma.layout)) {
      expect(layout[name as keyof typeof layout].css).toBe(token.css)
    }
  })
})

describe('tokens.css matches the Figma snapshot', () => {
  it('declares every Semantic css variable exactly once per theme, nothing else', () => {
    for (const theme of THEMES) {
      const decls = declarations(theme)
      expect(decls.map(([name]) => name)).toEqual(semanticEntries.map(([, t]) => t.css))
      // Hex в CSS регистронезависим (Prettier приводит к нижнему регистру).
      const lowered = decls.map(([name, value]) => [name, value.toLowerCase()])
      for (const [, token] of semanticEntries) {
        expect(lowered).toContainEqual([token.css, token[MODE_OF[theme]].toLowerCase()])
      }
    }
  })

  it('declares Layout and effect variables once in :root with units and quoted strings', () => {
    const decls = declarations()
    expect(decls.map(([name]) => name)).toEqual([
      ...Object.values(figma.layout).map((t) => t.css),
      ...Object.values(figma.effectStyles).map((t) => t.css),
    ])
    const values = new Map(decls)
    expect(values.get('--space-1')).toBe('4px')
    expect(values.get('--radius-lg')).toBe('22px')
    expect(values.get('--radius-full')).toBe('999px')
    expect(values.get('--size-window-max')).toBe('1120px')
    expect(values.get('--font-text')).toBe("'Bricolage Grotesque'")
    expect(values.get('--shadow-card')).toBe(figma.effectStyles['Elevation/Card'].value)
  })

  it('is marked as generated', () => {
    expect(tokensCss).toContain('GENERATED from figma-tokens.json')
  })
})

describe('contrast (NFR3)', () => {
  for (const theme of THEMES) {
    for (const [fg, bg] of TEXT_ON_BG) {
      it(`${theme}: ${fg} on ${bg} is at least 4.5:1`, () => {
        expect(contrastRatio(palette[theme][fg], palette[theme][bg])).toBeGreaterThanOrEqual(4.5)
      })
    }
  }

  // knownIssue, Specs §7: status/danger в Night не проходит 4.5:1 на bg/surface, решение открыто.
  // Тест не «зеленит» проблему, а фиксирует текущее значение: изменится цвет в Figma — тест упадёт,
  // и knownIssue нужно будет пересмотреть (закрыть или обновить значение).
  it('knownIssue: night status/danger on bg/surface stays below 4.5:1 at its recorded value', () => {
    const ratio = contrastRatio(palette.night['status/danger'], palette.night['bg/surface'])
    expect(ratio).toBeLessThan(4.5)
    expect(ratio).toBeCloseTo(KNOWN_NIGHT_DANGER_RATIO, 1)
  })
})

describe('typography', () => {
  it('has no font size below 12px', () => {
    const layoutSizes = Object.entries(figma.layout)
      .filter(([name]) => name.startsWith('font/size-'))
      .map(([name, t]) => [name, Number(t.value)] as const)
    const styleSizes = Object.entries(figma.textStyles).map(([name, s]) => [name, s.size] as const)
    expect(layoutSizes.length).toBeGreaterThan(0)
    for (const [name, size] of [...layoutSizes, ...styleSizes]) {
      expect(size, name).toBeGreaterThanOrEqual(12)
    }
  })
})
