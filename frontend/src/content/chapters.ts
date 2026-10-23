// Главы острова: порядок маршрута (Figma BottomBar 19:450, figma-components.md). Подписи остановок
// в баре, пинах и prev/next — строки интерфейса: i18n `chapters.<id>.title/subtitle` (useChapterLabel).
// Тексты окон — контент (content/<lang>.json); здесь только навигационные данные.

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
}

/** Шесть остановок маршрута по порядку. */
export const ROUTE: readonly ChapterInfo[] = [
  { id: 'profile', index: '01' },
  { id: 'prospace', index: '02' },
  { id: 'timepath', index: '03' },
  { id: 'techstack', index: '04' },
  { id: 'education', index: '05' },
  { id: 'contact', index: '06' },
]

/** Окна вне маршрута: открываются кнопками и deep-link, без prev/next. */
export const EXTRA: readonly ChapterInfo[] = [
  { id: 'monitoring', index: '' },
  { id: 'summary', index: '' },
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
