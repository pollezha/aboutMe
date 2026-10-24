import { onBeforeUnmount, onMounted, watch } from 'vue'
import { isChapterId, type ChapterId } from '../content'
import { useRouteStore } from '../route'

/**
 * Окно ↔ URL-хэш (#prospace) и история (design §4 «Окна»): ссылку на главу можно отправить,
 * «Назад» закрывает окно. Открытие из UI — новая запись истории с state.chapter, prev/next — замена
 * этой записи. Запись, открытую по ссылке (#contact), считаем чужой: закрытие лишь убирает хэш.
 * При монтировании хэш открывает окно (deep link); `onWindowOpen` — обработчик `update:open` окна.
 */
export function useWindowHistory() {
  const route = useRouteStore()

  function ownsHistoryEntry() {
    return typeof (history.state as { chapter?: unknown } | null)?.chapter === 'string'
  }

  function urlWith(id: ChapterId | null) {
    const { pathname, search } = window.location
    return `${pathname}${search}${id ? `#${id}` : ''}`
  }

  function onWindowOpen(value: boolean) {
    if (value) return
    route.closeWindow()
    // Своя запись — уходим с неё; окно уже закрыто, popstate придёт на запись без главы.
    if (ownsHistoryEntry()) history.back()
  }

  watch(
    () => route.openWindow,
    (id, previous) => {
      const target = id ? `#${id}` : ''
      if (window.location.hash === target) return
      if (id && !previous) {
        history.pushState({ chapter: id }, '', urlWith(id))
      } else if (id) {
        const state = ownsHistoryEntry() ? { chapter: id } : history.state
        history.replaceState(state, '', urlWith(id))
      } else if (!ownsHistoryEntry()) {
        // Своя запись снимается history.back() в onWindowOpen; чужая — только теряет хэш.
        history.replaceState(history.state, '', urlWith(null))
      }
    },
  )

  /** Хэш главы открывает её окно; пустой или чужой хэш закрывает окно (Назад, ручная правка URL). */
  function syncFromLocation() {
    const id = window.location.hash.slice(1)
    if (isChapterId(id)) {
      if (route.openWindow !== id) route.openChapter(id)
    } else if (route.openWindow) {
      route.closeWindow()
    }
  }

  onMounted(() => {
    syncFromLocation()
    window.addEventListener('popstate', syncFromLocation)
    window.addEventListener('hashchange', syncFromLocation)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('popstate', syncFromLocation)
    window.removeEventListener('hashchange', syncFromLocation)
  })

  return { onWindowOpen }
}
