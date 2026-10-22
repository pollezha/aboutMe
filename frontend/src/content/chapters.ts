// Главы острова: порядок маршрута и подписи остановок (Figma BottomBar 19:450, figma-components.md).
// Контент окон — этап 3; здесь только навигационные данные.

export type ChapterId =
  | 'profile'
  | 'prospace'
  | 'timepath'
  | 'techstack'
  | 'education'
  | 'contact'
  | 'monitoring'
  | 'summary'

export interface ChapterInfo {
  id: ChapterId
  /** '01'…'06' для остановок маршрута, '' — вне маршрута. */
  index: string
  title: string
  subtitle: string
}

/** Шесть остановок маршрута по порядку. */
export const ROUTE: readonly ChapterInfo[] = [
  { id: 'profile', index: '01', title: 'Profile', subtitle: 'About me' },
  { id: 'prospace', index: '02', title: 'ProSpace', subtitle: 'Latest role' },
  { id: 'timepath', index: '03', title: 'TimePath', subtitle: 'Previous role' },
  { id: 'techstack', index: '04', title: 'Tech stack', subtitle: 'Skills' },
  { id: 'education', index: '05', title: 'Education', subtitle: 'BSc 2025' },
  { id: 'contact', index: '06', title: 'Contact', subtitle: 'Your team' },
]

/** Окна вне маршрута: открываются кнопками и deep-link, без prev/next. */
export const EXTRA: readonly ChapterInfo[] = [
  { id: 'monitoring', index: '', title: 'Monitoring', subtitle: 'This site, live' },
  { id: 'summary', index: '', title: '30-sec summary', subtitle: 'For recruiters' },
]

export const CHAPTERS: readonly ChapterInfo[] = [...ROUTE, ...EXTRA]

export function isChapterId(value: string): value is ChapterId {
  return CHAPTERS.some((chapter) => chapter.id === value)
}

export function chapterInfo(id: ChapterId): ChapterInfo {
  const found = CHAPTERS.find((chapter) => chapter.id === id)
  if (!found) throw new Error(`unknown chapter ${id}`)
  return found
}

/** Соседи по маршруту: у 01 нет prev, у 06 нет next, у глав вне маршрута — ни того, ни другого. */
export function routeNeighbours(id: ChapterId): { prev?: ChapterInfo; next?: ChapterInfo } {
  const at = ROUTE.findIndex((chapter) => chapter.id === id)
  if (at < 0) return {}
  return { prev: ROUTE[at - 1], next: ROUTE[at + 1] }
}
