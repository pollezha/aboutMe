import type { ContentBundle, ContentLang, ExperienceEntry, Metric } from './types'

// Стаж считается из дат контента (D21), а не хранится строкой.
// Месяц — целая единица: `from` и закрытый `to` включительно, `to: null` — до начала текущего месяца.

export interface Duration {
  years: number
  months: number
}

/** Полные названия месяцев после «since»/«с» (RU — родительный падеж). */
export const SINCE_MONTHS: Record<ContentLang, string[]> = {
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
  // родительный падеж: «с июля 2024»
  ru: [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
  ],
}

/** `YYYY-MM` → номер месяца от нулевого года. */
function monthIndex(yearMonth: string): number {
  const [year, month] = yearMonth.split('-').map(Number)
  return (year ?? 0) * 12 + (month ?? 1) - 1
}

export function totalExperience(experience: ExperienceEntry[], now = new Date()): Duration {
  const current = now.getFullYear() * 12 + now.getMonth()
  const periods = experience
    .map((entry) => ({
      start: monthIndex(entry.from),
      end: entry.to === null ? current : monthIndex(entry.to) + 1,
    }))
    .filter((period) => period.end > period.start)
    .sort((a, b) => a.start - b.start)

  let total = 0
  let coveredUntil = -Infinity
  for (const { start, end } of periods) {
    const from = Math.max(start, coveredUntil)
    if (end > from) total += end - from
    coveredUntil = Math.max(coveredUntil, end)
  }
  return { years: Math.floor(total / 12), months: total % 12 }
}

/**
 * Срок технологии (FR6): объединение периодов ролей из `usedIn`.
 * Пересечения считаются один раз, неизвестные id и повторы игнорируются.
 */
export function serverExperience(
  usedIn: readonly string[],
  experience: ExperienceEntry[],
  now = new Date(),
): Duration {
  const ids = new Set(usedIn)
  return totalExperience(
    experience.filter((entry) => ids.has(entry.id)),
    now,
  )
}

function years(count: number, lang: ContentLang, plus = ''): string {
  if (lang === 'ru') return `${count}${plus} г.`
  return `${count}${plus} ${count === 1 && !plus ? 'yr' : 'yrs'}`
}

function months(count: number, lang: ContentLang): string {
  return lang === 'ru' ? `${count} мес.` : `${count} mo`
}

/** «2 yrs 3 mo», «2 yrs», «5 mo». */
export function formatExperience(duration: Duration, lang: ContentLang = 'en'): string {
  const parts: string[] = []
  if (duration.years > 0) parts.push(years(duration.years, lang))
  if (duration.months > 0 || duration.years === 0) parts.push(months(duration.months, lang))
  return parts.join(' ')
}

const TERM_UNITS: Record<ContentLang, { years: string; months: string }> = {
  en: { years: 'y', months: 'm' },
  ru: { years: 'г.', months: 'мес.' },
}

/** Срок сервера в стойке (Figma Rack/Server): «2 y 3 m», «2 y», «9 m». */
export function formatTerm(duration: Duration, lang: ContentLang = 'en'): string {
  const units = TERM_UNITS[lang]
  const parts: string[] = []
  if (duration.years > 0) parts.push(`${duration.years} ${units.years}`)
  if (duration.months > 0 || duration.years === 0) parts.push(`${duration.months} ${units.months}`)
  return parts.join(' ')
}

/** Короткое значение метрики: «2+ yrs», «2 yrs», «5 mo». */
export function experienceBadge(duration: Duration, lang: ContentLang = 'en'): string {
  if (duration.years === 0) return months(duration.months, lang)
  return years(duration.years, lang, duration.months > 0 ? '+' : '')
}

/** «since July 2024» по самому раннему `from`; пустая строка без опыта. */
export function sinceLabel(experience: ExperienceEntry[], lang: ContentLang = 'en'): string {
  const earliest = experience.map((entry) => entry.from).sort()[0]
  if (earliest === undefined) return ''
  const [year, month] = earliest.split('-').map(Number)
  const name = SINCE_MONTHS[lang][(month ?? 1) - 1]
  return lang === 'ru' ? `с ${name} ${year}` : `since ${name} ${year}`
}

/** Метрики первого экрана с подставленным стажем. */
export function resolveHighlights(content: ContentBundle, now = new Date()): Metric[] {
  return content.profile.highlights.map((highlight) => {
    if ('kind' in highlight) {
      return {
        label: highlight.label,
        value: experienceBadge(totalExperience(content.experience, now), content.lang),
        note: sinceLabel(content.experience, content.lang),
      }
    }
    return { label: highlight.label, value: highlight.value, note: highlight.note }
  })
}
