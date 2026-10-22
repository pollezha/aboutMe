import { describe, expect, it } from 'vitest'
import en from '../../../../content/en.json'
import {
  experienceBadge,
  formatExperience,
  formatTerm,
  resolveHighlights,
  serverExperience,
  sinceLabel,
  totalExperience,
} from '../experience'
import type { ContentBundle, ExperienceEntry } from '../types'

const NOW = new Date(2026, 9, 22)

const career: ExperienceEntry[] = [
  { id: 'timepath', company: 'TimePath', role: 'Backend', from: '2024-07', to: '2025-12' },
  { id: 'prospace', company: 'ProSpace', role: 'Backend', from: '2026-01', to: null },
]

function entry(from: string, to: string | null): ExperienceEntry {
  return { id: from, company: 'A', role: 'R', from, to }
}

describe('totalExperience', () => {
  it('sums consecutive periods up to now for the current role', () => {
    expect(totalExperience(career, NOW)).toEqual({ years: 2, months: 3 })
  })

  it('counts a single open period from its start month to now', () => {
    expect(totalExperience([entry('2024-07', null)], NOW)).toEqual({ years: 2, months: 3 })
  })

  it('counts exactly 24 months as two whole years', () => {
    expect(totalExperience([entry('2024-10', null)], NOW)).toEqual({ years: 2, months: 0 })
  })

  it('counts an overlap once', () => {
    const overlapping = [entry('2024-01', '2024-12'), entry('2024-07', '2025-06')]

    expect(totalExperience(overlapping, NOW)).toEqual({ years: 1, months: 6 })
  })

  it('does not count a gap between periods', () => {
    const withGap = [entry('2023-01', '2023-03'), entry('2024-01', '2024-02')]

    expect(totalExperience(withGap, NOW)).toEqual({ years: 0, months: 5 })
  })

  it('returns zero for no experience', () => {
    expect(totalExperience([], NOW)).toEqual({ years: 0, months: 0 })
  })

  it('uses the current date by default', () => {
    const today = new Date()
    const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

    expect(totalExperience([entry(from, null)])).toEqual({ years: 0, months: 0 })
  })
})

describe('formatExperience', () => {
  it('formats years and months', () => {
    expect(formatExperience({ years: 2, months: 3 })).toBe('2 yrs 3 mo')
  })

  it('omits zero months', () => {
    expect(formatExperience({ years: 2, months: 0 })).toBe('2 yrs')
  })

  it('omits zero years', () => {
    expect(formatExperience({ years: 0, months: 5 })).toBe('5 mo')
  })

  it('uses the singular for one year', () => {
    expect(formatExperience({ years: 1, months: 2 })).toBe('1 yr 2 mo')
  })

  it('formats in Russian', () => {
    expect(formatExperience({ years: 2, months: 3 }, 'ru')).toBe('2 г. 3 мес.')
  })
})

describe('experienceBadge', () => {
  it('shows whole years with a plus when there are extra months', () => {
    expect(experienceBadge({ years: 2, months: 3 })).toBe('2+ yrs')
  })

  it('shows whole years without a plus for exactly 24 months', () => {
    expect(experienceBadge({ years: 2, months: 0 })).toBe('2 yrs')
  })

  it('shows months when under a year', () => {
    expect(experienceBadge({ years: 0, months: 5 })).toBe('5 mo')
  })
})

describe('sinceLabel', () => {
  it('names the earliest start month', () => {
    expect(sinceLabel([...career].reverse())).toBe('since July 2024')
  })

  it('names the earliest start month in Russian', () => {
    expect(sinceLabel(career, 'ru')).toBe('с июля 2024')
  })
})

describe('serverExperience', () => {
  const overlapping: ExperienceEntry[] = [
    { id: 'a', company: 'A', role: 'R', from: '2024-01', to: '2024-12' },
    { id: 'b', company: 'B', role: 'R', from: '2024-07', to: '2025-06' },
    { id: 'c', company: 'C', role: 'R', from: '2026-01', to: null },
  ]

  it('counts only the roles the server was used in', () => {
    expect(serverExperience(['timepath'], career, NOW)).toEqual({ years: 1, months: 6 })
    expect(serverExperience(['prospace'], career, NOW)).toEqual({ years: 0, months: 9 })
  })

  it('joins the intervals of several roles up to the current month', () => {
    expect(serverExperience(['timepath', 'prospace'], career, NOW)).toEqual({
      years: 2,
      months: 3,
    })
  })

  it('counts overlapping roles once', () => {
    expect(serverExperience(['a', 'b'], overlapping, NOW)).toEqual({ years: 1, months: 6 })
  })

  it('ignores the order and duplicates of usedIn', () => {
    expect(serverExperience(['b', 'a', 'b'], overlapping, NOW)).toEqual({ years: 1, months: 6 })
  })

  it('returns zero for roles that are not in experience[]', () => {
    expect(serverExperience(['unknown'], career, NOW)).toEqual({ years: 0, months: 0 })
  })

  it('computes every published server from its roles', () => {
    const content = en as ContentBundle
    const servers = content.chapters.techstack.racks.flatMap((rack) => rack.servers)
    const csharp = servers.find((server) => server.name === 'C# / .NET')

    expect(servers.length).toBeGreaterThan(0)
    expect(serverExperience(csharp!.usedIn, content.experience, NOW)).toEqual({
      years: 2,
      months: 3,
    })
  })
})

describe('resolveHighlights', () => {
  it('computes the experience metric from content dates, not from a string', () => {
    const highlights = resolveHighlights(en as ContentBundle, NOW)

    expect(highlights).toHaveLength(3)
    expect(highlights[2]).toEqual({
      label: 'IN PRODUCTION',
      value: '2+ yrs',
      note: 'since July 2024',
    })
  })

  it('passes static metrics through unchanged', () => {
    const highlights = resolveHighlights(en as ContentBundle, NOW)

    expect(highlights[0]).toEqual({
      label: 'SHIPMENTS / DAY',
      value: '1000+',
      note: 'through my last module',
    })
  })
})

describe('formatTerm', () => {
  it('prints years and months in the short server form', () => {
    expect(formatTerm({ years: 2, months: 3 })).toBe('2 y 3 m')
    expect(formatTerm({ years: 2, months: 0 })).toBe('2 y')
    expect(formatTerm({ years: 0, months: 9 })).toBe('9 m')
    expect(formatTerm({ years: 0, months: 0 })).toBe('0 m')
  })

  it('has a Russian form', () => {
    expect(formatTerm({ years: 1, months: 4 }, 'ru')).toBe('1 г. 4 мес.')
  })
})
