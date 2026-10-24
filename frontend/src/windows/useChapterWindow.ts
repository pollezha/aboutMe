import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  BUILD_TIME,
  ROUTE,
  chapterInfo,
  contentFor,
  resolveChapter,
  routeNeighbours,
  type ChapterId,
} from '../content'
import { WINDOWS } from '../chapters'
import { useChapterLabel, useLangStore } from '../locale'
import { useRouteStore } from '../route'

/**
 * Данные открытого окна (`route.openWindow`) на языке страницы: шапка и подвал — из контента главы
 * с датами от времени сборки, eyebrow «Stop N of 6 · …» у остановок маршрута, знак и тело — из реестра,
 * соседи по маршруту для prev/next. Окно закрыто — `view` равен null.
 */
export function useChapterWindow() {
  const route = useRouteStore()
  const langStore = useLangStore()
  const { t } = useI18n()
  const chapterLabel = useChapterLabel()
  // Пока RU-контента нет — EN (contentFor); загрузка из content-api — этап 4.
  const content = computed(() => contentFor(langStore.lang))
  // Даты в тексте — от времени сборки: предрендер и клиент показывают одно и то же.
  const now = BUILD_TIME

  const linkTo = (id: ChapterId | undefined) =>
    id ? { id, number: chapterInfo(id).index, title: chapterLabel(id).title } : undefined

  const view = computed(() => {
    const id = route.openWindow
    if (!id) return null
    const { index } = chapterInfo(id)
    const text = resolveChapter(content.value, id, now)
    // «Stop N of 6 · …» (R2) — только у остановок маршрута.
    const eyebrow = index
      ? `${t('window.stop', { n: Number(index), total: ROUTE.length })} · ${text.eyebrow}`
      : text.eyebrow
    const { prev, next } = routeNeighbours(id)
    return {
      id,
      number: index,
      eyebrow,
      title: text.title,
      subtitle: text.subtitle,
      proofLinks: text.proofLinks,
      sign: WINDOWS[id].sign,
      body: WINDOWS[id].body,
      prev: linkTo(prev?.id),
      next: linkTo(next?.id),
    }
  })

  function go(to: 'prev' | 'next') {
    const target = view.value?.[to]
    if (target) route.openChapter(target.id)
  }

  return { view, content, now, goPrev: () => go('prev'), goNext: () => go('next') }
}
