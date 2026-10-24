// Клик по сцене → глава. Здание остановки — группа с userData.chapter; луч попадает в её меш.
import type { Object3D } from 'three'
import { isChapterId, type ChapterId } from '../content'

export function pickChapter(object: Object3D | null | undefined): ChapterId | null {
  for (let node = object; node; node = node.parent) {
    const chapter: unknown = node.userData.chapter
    if (typeof chapter === 'string') return isChapterId(chapter) ? chapter : null
  }
  return null
}

interface SceneClick {
  object: Object3D
  stopPropagation: () => void
}

/** Обработчик @click группы зданий: ближайшее попадание → openChapter, дальше событие не идёт. */
export function chapterClickHandler(open: (id: ChapterId) => void) {
  return (event: SceneClick) => {
    const chapter = pickChapter(event.object)
    if (!chapter) return
    event.stopPropagation()
    open(chapter)
  }
}
