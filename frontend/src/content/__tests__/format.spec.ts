import { describe, expect, it } from 'vitest'
import { fillDates, formatPeriod, resolveChapter, resolveMetric, serverTenure } from '../format'
import type { ContentBundle, ExperienceEntry } from '../types'
import en from '../../../../content/en.json'

const experience: ExperienceEntry[] = [
  { id: 'timepath', company: 'TimePath', role: 'Dev', from: '2024-07', to: '2025-12' },
  { id: 'prospace', company: 'ProSpace', role: 'Dev', from: '2026-01', to: null },
]
// 23 Oct 2026: текущий месяц — октябрь, стаж до начала месяца — 2 г. 3 мес.
const now = new Date(2026, 9, 23)

describe('fillDates', () => {
  it('fills {since} and {sinceShort} from the earliest start', () => {
    expect(fillDates('since {since} · {sinceShort}', { experience, now })).toBe(
      'since July 2024 · Jul 2024',
    )
  })

  it('fills {experience} with the total time in production', () => {
    expect(fillDates('{experience} in production', { experience, now })).toBe(
      '2 yrs 3 mo in production',
    )
  })

  it('fills {span} with the years of all roles, an open role up to now', () => {
    expect(fillDates('Data center · {span}', { experience, now })).toBe('Data center · 2024 – 2026')
  })

  it('fills {period} of a closed role across years', () => {
    expect(fillDates('{period}', { experience, experienceId: 'timepath', now })).toBe(
      'Jul 2024 – Dec 2025',
    )
  })

  it('fills {period} of the current role up to the current month', () => {
    expect(fillDates('Latest role · {period}', { experience, experienceId: 'prospace', now })).toBe(
      'Latest role · Jan – Oct 2026',
    )
  })

  it('keeps {period} when the chapter has no role', () => {
    expect(fillDates('{period}', { experience, now })).toBe('{period}')
    expect(fillDates('{period}', { experience, experienceId: 'nope', now })).toBe('{period}')
  })

  it('keeps unknown tokens and plain text as is', () => {
    expect(fillDates('{nope} and {since}', { experience, now })).toBe('{nope} and July 2024')
    expect(fillDates('no tokens', { experience, now })).toBe('no tokens')
  })

  it('keeps date tokens when there is no experience', () => {
    expect(fillDates('{since} {span}', { experience: [], now })).toBe('{since} {span}')
  })
})

describe('formatPeriod', () => {
  it('shows a single month once', () => {
    expect(formatPeriod({ from: '2026-10', to: null }, now)).toBe('Oct 2026')
  })

  it('shows one year once for a span inside it', () => {
    expect(formatPeriod({ from: '2025-02', to: '2025-06' }, now)).toBe('Feb – Jun 2025')
  })
})

describe('resolveChapter', () => {
  const content = en as ContentBundle

  it('fills every string of the chapter, using its own role for {period}', () => {
    const chapter = resolveChapter(content, 'prospace', now)
    expect(chapter.eyebrow).toBe('Waybill · Latest role · Jan – Oct 2026')
    expect(JSON.stringify(chapter)).not.toMatch(/\{(since|sinceShort|experience|span|period)\}/)
  })

  it('fills nested meta values', () => {
    expect(resolveChapter(content, 'profile', now).since.value).toBe(
      'July 2024 · 2 yrs 3 mo in production',
    )
  })
})

describe('resolveMetric', () => {
  it('computes an experience metric from dates', () => {
    const content = { ...(en as ContentBundle), experience }
    expect(
      resolveMetric(
        { kind: 'experience', label: 'IN PRODUCTION', note: 'since {since}' },
        content,
        now,
      ),
    ).toEqual({ label: 'IN PRODUCTION', value: '2+ yrs', note: 'since July 2024', accent: false })
  })

  it('passes a static metric through', () => {
    const content = en as ContentBundle
    expect(
      resolveMetric({ label: 'A', value: '1', note: 'n', accent: true }, content, now),
    ).toEqual({ label: 'A', value: '1', note: 'n', accent: true })
  })
})

describe('serverTenure', () => {
  it('computes the term and the start month from the roles in usedIn', () => {
    expect(serverTenure(['timepath', 'prospace'], experience, now)).toEqual({
      term: '2 y 3 m',
      since: 'since Jul 2024',
      label: '2 y 3 m · since Jul 2024',
    })
    expect(serverTenure(['prospace'], experience, now).label).toBe('9 m · since Jan 2026')
  })

  it('counts overlapping roles once', () => {
    const overlapping: ExperienceEntry[] = [
      { id: 'a', company: 'A', role: 'Dev', from: '2025-01', to: '2025-12' },
      { id: 'b', company: 'B', role: 'Dev', from: '2025-07', to: '2026-06' },
    ]
    expect(serverTenure(['a', 'b'], overlapping, now).label).toBe('1 y 6 m · since Jan 2025')
  })

  it('says «с июл 2024» after the term in Russian', () => {
    expect(serverTenure(['timepath', 'prospace'], experience, now, 'ru').label).toBe(
      '2 г. 3 мес. · с июл 2024',
    )
  })
})

describe('fillDates in Russian', () => {
  const ru = { experience, now, lang: 'ru' as const }

  it('fills {since} in the genitive case: every RU text puts it after «с»', () => {
    expect(fillDates('в пути с {since}', ru)).toBe('в пути с июля 2024')
  })

  it('fills {sinceShort} with a short genitive month', () => {
    expect(fillDates('с {sinceShort}', ru)).toBe('с июл 2024')
    const may: ExperienceEntry[] = [
      { id: 'x', company: 'X', role: 'Dev', from: '2024-05', to: '2024-06' },
    ]
    expect(fillDates('с {sinceShort}', { ...ru, experience: may })).toBe('с мая 2024')
  })

  it('fills {experience} with years and months in Russian', () => {
    expect(fillDates('{experience} в продакшене', ru)).toBe('2 г. 3 мес. в продакшене')
  })

  it('fills {span} the same way as in English', () => {
    expect(fillDates('Дата-центр · {span}', ru)).toBe('Дата-центр · 2024 – 2026')
  })

  it('fills {period} with short Russian months', () => {
    expect(fillDates('{period}', { ...ru, experienceId: 'timepath' })).toBe('июл 2024 – дек 2025')
    expect(fillDates('{period}', { ...ru, experienceId: 'prospace' })).toBe('янв – окт 2026')
  })

  it('names May in the nominative inside a period', () => {
    expect(formatPeriod({ from: '2025-05', to: '2025-05' }, now, 'ru')).toBe('май 2025')
  })
})
