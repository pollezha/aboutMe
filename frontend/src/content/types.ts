// Типы контента — зеркало content/schema/content.schema.json (источник истины — схема).

export type ContentLang = 'en' | 'ru'

export type LinkKind = 'github' | 'telegram' | 'hh' | 'linkedin' | 'email' | 'cv'

export interface ContentLink {
  kind: LinkKind
  label: string
  href: string
}

/** Метрика с готовым текстом. */
export interface StaticHighlight {
  label: string
  value: string
  note: string
}

/** Стаж: значение и подпись считаются из `experience[]` при рендере. */
export interface ExperienceHighlight {
  kind: 'experience'
  label: string
}

export type Highlight = StaticHighlight | ExperienceHighlight

export interface Profile {
  name: string
  role: string
  status: string
  workFormat: string
  location: string
  /** Короткая локация для строки-меты Hero: «Serbia · CET». */
  locationShort: string
  highlights: Highlight[]
  links: ContentLink[]
}

/** Месяцы включительно, `YYYY-MM`; `to: null` — текущая роль. */
export interface ExperienceEntry {
  id: string
  company: string
  role: string
  from: string
  to: string | null
}

export interface ContentBundle {
  contentVersion: string
  lang: ContentLang
  profile: Profile
  experience: ExperienceEntry[]
}

/** Метрика, готовая к показу (строка метрик HeroCard, MetricCard). */
export interface Metric {
  label: string
  value: string
  note: string
}
