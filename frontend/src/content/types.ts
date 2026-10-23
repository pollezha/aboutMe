// Типы контента — зеркало content/schema/content.schema.json (источник истины — схема).

import type { ChapterId } from './chapters'

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

// --- Окна глав (`chapters`). Тексты могут содержать токены дат, их подставляет код из `experience[]`:
// {since} «July 2024», {sinceShort} «Jul 2024», {experience} «2 yrs 3 mo», {span} «2024 – 2026»,
// {period} «Jan – Oct 2026» (только в главе с `experienceId`). Префикс «Stop N of 6» — код, не контент.
// RU: {since}/{sinceShort} — родительный падеж («с июля 2024», «с июл 2024»), {period} — «янв – окт 2026».

/** Ссылка подвала на внешнюю страницу или файл. */
export interface HrefProofLink {
  label: string
  href: string
  icon: 'external' | 'download'
}

/** Ссылка, открывающая другое окно (иконка arrow-right). */
export interface ChapterProofLink {
  label: string
  chapter: ChapterId
}

export type ProofLink = HrefProofLink | ChapterProofLink

export interface MetaItem {
  label: string
  value: string
}

export interface LabelOnly {
  label: string
}

export interface ChipGroup {
  label: string
  items: string[]
}

export interface BulletGroup {
  label: string
  items: string[]
}

export interface KeyResult {
  result: string
  how: string
}

export interface KeyResultList {
  heading: string
  items: KeyResult[]
}

export interface StaticChapterMetric {
  label: string
  value: string
  note: string
  /** Tone=accent: полоса цвета главы. */
  accent?: boolean
}

/** Стаж из `experience[]`; `note` может содержать токены дат. */
export interface ExperienceChapterMetric {
  kind: 'experience'
  label: string
  note?: string
  accent?: boolean
}

export type ChapterMetric = StaticChapterMetric | ExperienceChapterMetric

export interface MetricGroup {
  label: string
  metrics: ChapterMetric[]
}

interface ChapterBase {
  eyebrow: string
  title: string
  subtitle: string
  proofLinks: ProofLink[]
}

export interface ProfileChapter extends ChapterBase {
  name: MetaItem
  since: MetaItem
  /** Подпись блока; сами метрики — `profile.highlights`. */
  keyNumbers: LabelOnly
  about: MetaItem
  languages: ChipGroup
  lookingFor: MetaItem
}

export interface ProSpaceChapter extends ChapterBase {
  /** `experience[].id` роли — источник {period}. */
  experienceId: string
  metrics: ChapterMetric[]
  keyResults: KeyResultList
  stack: ChipGroup
  team: MetaItem
}

export interface TimePathChapter extends ChapterBase {
  experienceId: string
  metricGroups: MetricGroup[]
  keyResults: KeyResultList
  stack: ChipGroup
}

/** Технология; срок — объединение периодов ролей из `usedIn` (`serverExperience`). */
export interface Server {
  name: string
  /** `experience[].id`, минимум одна. */
  usedIn: string[]
  where: string
  what: string
}

export interface Rack {
  name: string
  servers: Server[]
}

export interface TechStackChapter extends ChapterBase {
  experienceLabel: string
  whereLabel: string
  whatLabel: string
  racks: Rack[]
}

export interface EducationChapter extends ChapterBase {
  programme: MetaItem
  format: MetaItem
  graduated: MetaItem
  thesis: MetaItem
  teamProjects: BulletGroup
  courses: ChipGroup
  studyWork: BulletGroup
  languages: ChipGroup
}

export interface ContactChapter extends ChapterBase {
  role: MetaItem
  /** Подпись STATUS + текст StatusPill. */
  status: MetaItem
  basedIn: MetaItem
  languages: ChipGroup
  goodFit: ChipGroup
  summaryLink: ChapterProofLink
  contacts: ContentLink[]
  /** Этап 3: карточка вместо формы (форма — этап 4). */
  mailbox: { heading: string; text: string; action: { label: string; href: string } }
}

export interface SummaryChapter extends ChapterBase {
  metrics: ChapterMetric[]
  whatIDo: KeyResultList
  cta: { contact: ChapterProofLink; cv: HrefProofLink }
}

/** Только тексты: значения метрик и строка статуса — живая доска (этап 4). */
export interface MonitoringChapter extends ChapterBase {
  metrics: { label: string; note: string }[]
  clickPath: { heading: string; steps: string[] }
  observability: { heading: string; items: MetaItem[] }
}

export interface Chapters {
  profile: ProfileChapter
  prospace: ProSpaceChapter
  timepath: TimePathChapter
  techstack: TechStackChapter
  education: EducationChapter
  contact: ContactChapter
  summary: SummaryChapter
  monitoring: MonitoringChapter
}

export interface ContentBundle {
  contentVersion: string
  lang: ContentLang
  profile: Profile
  experience: ExperienceEntry[]
  chapters: Chapters
}

/** Метрика, готовая к показу (строка метрик HeroCard, MetricCard). */
export interface Metric {
  label: string
  value: string
  note: string
}
