import { describe, expect, it } from 'vitest'
import figma from '../../../scripts/design/figma-tokens.json'
import tokensCss from '../tokens.css?raw'
import pinsCss from '../pins.css?raw'
import { contrastRatio } from '../contrast'
import { layout, palette, type SemanticToken, type ThemeName } from '../palette'
import { PIN_INK, type PinChapter } from '../pinInk'

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
  // Было knownIssue (Specs §7, Night 2.8:1) — закрыто дизайном: Night = red/300 #F07070.
  ['status/danger', 'bg/surface'],
]

// Текст на серверной (chapter/techstack): в Day/Evening она тёмная — светлый текст;
// в Night светлая (ink/300) — text/primary #F3F5F8 на ней не читается, нужен тёмный ink/900.
const TECHSTACK_INK: Record<ThemeName, SemanticToken> = {
  day: 'text/on-dark',
  evening: 'text/on-dark',
  night: 'text/on-accent',
}

// Фоны, на которых может оказаться кольцо фокуса (WCAG 1.4.11: ≥ 3:1).
const FOCUS_BACKGROUNDS: SemanticToken[] = [
  'bg/surface',
  'bg/surface-alt',
  'bg/canvas',
  'accent/primary',
]

const PIN_CHAPTERS = semanticNames
  .filter((name) => name.startsWith('chapter/'))
  .map((name) => name.slice('chapter/'.length)) as PinChapter[]

// knownIssue: chapter/profile #2F6BFF в Day/Evening не даёт 4.5:1 ни со светлым (4.12), ни с тёмным
// (3.83) номером на пине — нужен более тёмный синий в Figma. Зафиксировано текущее значение:
// изменится цвет — тест упадёт, и knownIssue нужно будет закрыть или обновить.
const KNOWN_PIN_ISSUES: Partial<Record<ThemeName, Partial<Record<PinChapter, number>>>> = {
  day: { profile: 4.12 },
  evening: { profile: 4.12 },
}

/** Объявления `--name: value` из единственного блока `:root` или `:root[data-theme=<theme>]`. */
function declarations(theme?: ThemeName, css: string = tokensCss): [string, string][] {
  // Кавычки атрибута для CSS не важны (Prettier ставит одинарные).
  const selector = theme ? `:root\\[data-theme=['"]${theme}['"]\\]` : ':root'
  const blocks = [...css.matchAll(new RegExp(`(?:^|\\n)${selector} \\{([^}]*)\\}`, 'g'))]
  expect(blocks, `exactly one block for ${theme ?? ':root'}`).toHaveLength(1)
  const body = blocks[0]?.[1] ?? ''
  return [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [
    m[1] ?? '',
    (m[2] ?? '').trim(),
  ])
}

/** Ожидаемое CSS-значение Layout-токена: числа — px, строки — в одинарных кавычках. */
function cssLayoutValue(token: { type: string; value: string | number }): string {
  return token.type === 'FLOAT' ? `${token.value}px` : `'${token.value}'`
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

  it('has exactly the Layout names with their css names and values', () => {
    expect(Object.keys(layout)).toEqual(Object.keys(figma.layout))
    for (const [name, token] of Object.entries(figma.layout)) {
      const entry = layout[name as keyof typeof layout]
      expect(entry.css, name).toBe(token.css)
      expect(entry.value, name).toBe(cssLayoutValue(token))
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

  it('declares Layout and effect variables once in :root with their Figma values', () => {
    const decls = declarations()
    expect(decls.map(([name]) => name)).toEqual([
      ...Object.values(figma.layout).map((t) => t.css),
      ...Object.values(figma.effectStyles).map((t) => t.css),
    ])
    const values = new Map(decls)
    for (const [name, token] of Object.entries(figma.layout)) {
      expect(values.get(token.css), name).toBe(cssLayoutValue(token))
    }
    for (const [name, effect] of Object.entries(figma.effectStyles)) {
      expect(values.get(effect.css), name).toBe(effect.value)
    }
    expect(values.get('--space-1')).toBe('4px')
    expect(values.get('--font-text')).toBe("'Bricolage Grotesque'")
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

  for (const theme of THEMES) {
    const ink = TECHSTACK_INK[theme]
    it(`${theme}: ${ink} on chapter/techstack is at least 4.5:1`, () => {
      expect(
        contrastRatio(palette[theme][ink], palette[theme]['chapter/techstack']),
      ).toBeGreaterThanOrEqual(4.5)
    })
  }
})

describe('focus ring (WCAG 1.4.11)', () => {
  for (const theme of THEMES) {
    for (const bg of FOCUS_BACKGROUNDS) {
      if (theme === 'night' && bg === 'accent/primary') continue
      it(`${theme}: focus/ring on ${bg} is at least 3:1`, () => {
        expect(
          contrastRatio(palette[theme]['focus/ring'], palette[theme][bg]),
        ).toBeGreaterThanOrEqual(3)
      })
    }
  }

  // knownIssue: Night focus/ring = yellow/400 на жёлтой Primary-кнопке — 1:1.
  // Night: focus на Primary-кнопке требует двойного кольца (surface 2px внутри) — реализовано в BaseButton.
  it('knownIssue: night focus/ring on accent/primary is below 3:1 (double ring in BaseButton)', () => {
    expect(
      contrastRatio(palette.night['focus/ring'], palette.night['accent/primary']),
    ).toBeLessThan(3)
    // Внутреннее кольцо bg/surface отделяет жёлтое кольцо от жёлтой кнопки.
    expect(
      contrastRatio(palette.night['focus/ring'], palette.night['bg/surface']),
    ).toBeGreaterThanOrEqual(3)
  })
})

describe('pin ink (number on a chapter pin or tag)', () => {
  it('covers every chapter in every theme', () => {
    for (const theme of THEMES) {
      expect(Object.keys(PIN_INK[theme])).toEqual(PIN_CHAPTERS)
    }
  })

  for (const theme of THEMES) {
    for (const chapter of PIN_CHAPTERS) {
      const known = KNOWN_PIN_ISSUES[theme]?.[chapter]
      const ratio = () =>
        contrastRatio(
          palette[theme][`text/${PIN_INK[theme][chapter]}`],
          palette[theme][`chapter/${chapter}`],
        )
      if (known === undefined) {
        it(`${theme}: pin ink on chapter/${chapter} is at least 4.5:1`, () => {
          expect(ratio()).toBeGreaterThanOrEqual(4.5)
        })
      } else {
        it(`knownIssue: ${theme} pin ink on chapter/${chapter} stays at ${known}:1`, () => {
          expect(ratio()).toBeLessThan(4.5)
          expect(ratio()).toBeCloseTo(known, 1)
        })
      }
    }
  }

  it('pins.css maps --pin-ink-<chapter> to the PIN_INK text token in every theme', () => {
    expect(pinsCss).toContain('GENERATED from figma-tokens.json')
    for (const theme of THEMES) {
      expect(declarations(theme, pinsCss)).toEqual(
        PIN_CHAPTERS.map((chapter) => [
          `--pin-ink-${chapter}`,
          `var(--text-${PIN_INK[theme][chapter]})`,
        ]),
      )
    }
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
