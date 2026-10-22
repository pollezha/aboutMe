import type { ChapterId } from './chapters'
import { experienceBadge, formatExperience, sinceLabel, totalExperience } from './experience'
import type { ChapterMetric, Chapters, ContentBundle, ContentLang, ExperienceEntry } from './types'

// Токены дат в текстах глав (схема `chapters`): даты не хранятся строками, а считаются из `experience[]`.
// {since} «July 2024», {sinceShort} «Jul 2024», {experience} «2 yrs 3 mo», {span} «2024 – 2026»,
// {period} «Jan – Oct 2026» (роль главы, `to: null` — по текущий месяц). Неизвестный токен остаётся как есть.

interface MonthNames {
  long: string[]
  short: string[]
}

// RU — задача T6 (склонения); пока любой язык форматируется как EN.
const MONTHS: Partial<Record<ContentLang, MonthNames>> & { en: MonthNames } = {
  en: {
    long: [
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
    short: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  },
}

const DASH = ' – '

export interface DateContext {
  experience: ExperienceEntry[]
  /** Роль главы — источник {period}; без неё токен не подставляется. */
  experienceId?: string
  now?: Date
  lang?: ContentLang
}

interface YearMonth {
  year: number
  /** 0…11 */
  month: number
}

function parse(yearMonth: string): YearMonth {
  const [year, month] = yearMonth.split('-').map(Number)
  return { year: year ?? 0, month: (month ?? 1) - 1 }
}

function endOf(entry: Pick<ExperienceEntry, 'to'>, now: Date): YearMonth {
  return entry.to === null ? { year: now.getFullYear(), month: now.getMonth() } : parse(entry.to)
}

function names(lang: ContentLang): MonthNames {
  return MONTHS[lang] ?? MONTHS.en
}

function monthYear(at: YearMonth, style: keyof MonthNames, lang: ContentLang): string {
  return `${names(lang)[style][at.month]} ${at.year}`
}

/** «Jul 2024 – Dec 2025», «Jan – Oct 2026», «Oct 2026»; `to: null` — по текущий месяц. */
export function formatPeriod(
  entry: Pick<ExperienceEntry, 'from' | 'to'>,
  now = new Date(),
  lang: ContentLang = 'en',
): string {
  const from = parse(entry.from)
  const to = endOf(entry, now)
  if (from.year !== to.year) {
    return `${monthYear(from, 'short', lang)}${DASH}${monthYear(to, 'short', lang)}`
  }
  if (from.month === to.month) return monthYear(to, 'short', lang)
  return `${names(lang).short[from.month]}${DASH}${monthYear(to, 'short', lang)}`
}

function earliest(experience: ExperienceEntry[]): YearMonth | undefined {
  const from = experience.map((entry) => entry.from).sort()[0]
  return from === undefined ? undefined : parse(from)
}

function span(experience: ExperienceEntry[], now: Date): string {
  const start = Math.min(...experience.map((entry) => parse(entry.from).year))
  const end = Math.max(...experience.map((entry) => endOf(entry, now).year))
  return start === end ? String(start) : `${start}${DASH}${end}`
}

type Resolver = (ctx: Required<Omit<DateContext, 'experienceId'>> & DateContext) => string | null

const TOKENS: Record<string, Resolver> = {
  since: ({ experience, lang }) => {
    const at = earliest(experience)
    return at ? monthYear(at, 'long', lang) : null
  },
  sinceShort: ({ experience, lang }) => {
    const at = earliest(experience)
    return at ? monthYear(at, 'short', lang) : null
  },
  experience: ({ experience, now, lang }) =>
    experience.length > 0 ? formatExperience(totalExperience(experience, now), lang) : null,
  span: ({ experience, now }) => (experience.length > 0 ? span(experience, now) : null),
  period: ({ experience, experienceId, now, lang }) => {
    const role = experience.find((entry) => entry.id === experienceId)
    return role ? formatPeriod(role, now, lang) : null
  },
}

/** Подставляет токены дат; неизвестный или неразрешимый токен остаётся в тексте. */
export function fillDates(text: string, context: DateContext): string {
  const ctx = { now: new Date(), lang: 'en' as ContentLang, ...context }
  return text.replace(/\{(\w+)\}/g, (token, name: string) => {
    const resolve = Object.hasOwn(TOKENS, name) ? TOKENS[name] : undefined
    return resolve?.(ctx) ?? token
  })
}

function fillDeep<T>(value: T, fill: (text: string) => string): T {
  if (typeof value === 'string') return fill(value) as T
  if (Array.isArray(value)) return value.map((item: unknown) => fillDeep(item, fill)) as T
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, fillDeep(item, fill)]),
    ) as T
  }
  return value
}

/** Глава с подставленными во все строки датами; {period} — по `experienceId` главы. */
export function resolveChapter<K extends ChapterId>(
  content: ContentBundle,
  id: K,
  now = new Date(),
): Chapters[K] {
  const chapter = content.chapters[id]
  const experienceId = 'experienceId' in chapter ? chapter.experienceId : undefined
  return fillDeep(chapter, (text) =>
    fillDates(text, { experience: content.experience, experienceId, now, lang: content.lang }),
  )
}

/** Метрика окна, готовая к `MetricCard`. */
export interface WindowMetric {
  label: string
  value: string
  note: string
  accent: boolean
}

/** Стаж-метрика считается из дат, у статичной токены дат подставляются в подписи. */
export function resolveMetric(
  metric: ChapterMetric,
  content: ContentBundle,
  now = new Date(),
): WindowMetric {
  const fill = (text: string) =>
    fillDates(text, { experience: content.experience, now, lang: content.lang })
  if ('kind' in metric) {
    return {
      label: fill(metric.label),
      value: experienceBadge(totalExperience(content.experience, now), content.lang),
      note:
        metric.note !== undefined
          ? fill(metric.note)
          : sinceLabel(content.experience, content.lang),
      accent: metric.accent ?? false,
    }
  }
  return {
    label: fill(metric.label),
    value: fill(metric.value),
    note: fill(metric.note),
    accent: metric.accent ?? false,
  }
}
