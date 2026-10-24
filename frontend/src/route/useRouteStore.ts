import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ROUTE, type ChapterId } from '../content'
import { load, loadSession, save, saveSession } from '../shared/lib'

const KEY = {
  motionPaused: 'aboutme.motionPaused',
  /** sessionStorage: посещённые остановки живут до закрытия вкладки (решение 19 ревью). */
  visited: 'aboutme.visited',
} as const

// Хранилище недоступно или в нём мусор — отметки живут только в памяти.
function loadVisited(): Set<ChapterId> {
  try {
    const saved: unknown = JSON.parse(loadSession(KEY.visited) ?? '[]')
    if (!Array.isArray(saved)) return new Set()
    return new Set(ROUTE.map((stop) => stop.id).filter((id) => saved.includes(id)))
  } catch {
    return new Set()
  }
}

function saveVisited(ids: Set<ChapterId>) {
  saveSession(KEY.visited, JSON.stringify([...ids]))
}

export const useRouteStore = defineStore('route', () => {
  const motionPaused = ref(load(KEY.motionPaused) === 'true')
  const activeStop = ref<ChapterId | null>(null)
  const openWindow = ref<ChapterId | null>(null)
  /** Остановки маршрута, чьи окна открывали в этой сессии: в баре — галочка (если остановка не активна). */
  const visitedStops = ref<Set<ChapterId>>(loadVisited())

  function toggleMotion() {
    motionPaused.value = !motionPaused.value
    save(KEY.motionPaused, String(motionPaused.value))
  }

  /**
   * Клик по остановке/хотспоту/кнопке/deep-link: окно открывается сразу (D5), остановка становится
   * активной и посещённой; грузовик сцены едет к ней фоном (Truck.vue).
   */
  function openChapter(id: ChapterId) {
    activeStop.value = id
    openWindow.value = id
    if (ROUTE.some((stop) => stop.id === id) && !visitedStops.value.has(id)) {
      visitedStops.value = new Set([...visitedStops.value, id])
      saveVisited(visitedStops.value)
    }
  }

  function closeWindow() {
    openWindow.value = null
  }

  return {
    motionPaused,
    activeStop,
    openWindow,
    visitedStops,
    toggleMotion,
    openChapter,
    closeWindow,
  }
})
