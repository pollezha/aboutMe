import { describe, expect, it } from 'vitest'
import { contrastRatio, relativeLuminance } from '../contrast'

describe('contrastRatio', () => {
  it('is 21 for black on white and symmetric', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5)
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5)
  })

  it('is 1 for identical colors', () => {
    expect(contrastRatio('#5B6675', '#5B6675')).toBe(1)
  })

  it('matches the known WCAG value for #767676 on white (4.54)', () => {
    expect(contrastRatio('#767676', '#fff')).toBeCloseTo(4.54, 2)
  })

  it('computes relative luminance per WCAG', () => {
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5)
    expect(relativeLuminance('#000')).toBe(0)
  })

  it('rejects invalid hex', () => {
    expect(() => contrastRatio('red', '#fff')).toThrow(/Invalid hex/)
  })
})
