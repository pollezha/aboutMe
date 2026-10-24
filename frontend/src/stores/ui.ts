import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ROUTE, type ChapterId } from '../content'
import { load, loadSession, save, saveSession } from '../shared/lib'

export type Lang = 'en' | 'ru'
export type Mode = '3d' | '2d'
/** idle — сцена не грузится; loading — ждём scene_ready; ready — сцена на экране; failed — таймаут/ошибка, показан баннер. */
export type SceneState = 'idle' | 'loading' | 'ready' | 'failed'

const LANGS: readonly Lang[] = ['en', 'ru']
const MODES: readonly Mode[] = ['3d', '2d']

const KEY = {
  lang: 'aboutme.lang',
  motionPaused: 'aboutme.motionPaused',
  sceneChoice: 'aboutme.sceneChoice',
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

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

export const useUiStore = defineStore('ui', () => {
  const lang = ref<Lang>(pick(load(KEY.lang), LANGS, 'en'))
  const motionPaused = ref(load(KEY.motionPaused) === 'true')
  const mode = ref<Mode>('3d')
  /** Явный выбор пользователя (FR10); null — не выбирал, режим решает shouldUse3D(). */
  const savedChoice = load(KEY.sceneChoice)
  const userChoice = ref<Mode | null>(
    MODES.includes(savedChoice as Mode) ? (savedChoice as Mode) : null,
  )
  const sceneState = ref<SceneState>('idle')
  const activeStop = ref<ChapterId | null>(null)
  const openWindow = ref<ChapterId | null>(null)
  /** Остановки маршрута, чьи окна открывали в этой сессии: в баре — галочка (если остановка не активна). */
  const visitedStops = ref<Set<ChapterId>>(loadVisited())

  /** Выбор пользователя (переключатель): запоминается; App переводит маршрут на /ru/ или /. */
  function setLang(next: Lang) {
    lang.value = next
    save(KEY.lang, next)
  }

  /** Язык из маршрута (/ или /ru/): ссылка на страницу — не выбор пользователя, не запоминаем. */
  function syncLang(next: Lang) {
    lang.value = next
  }

  function toggleLang() {
    setLang(lang.value === 'en' ? 'ru' : 'en')
  }

  function toggleMotion() {
    motionPaused.value = !motionPaused.value
    save(KEY.motionPaused, String(motionPaused.value))
  }

  function setMode(next: Mode) {
    mode.value = next
  }

  function setSceneState(next: SceneState) {
    sceneState.value = next
  }

  /** Кнопка «Switch to 2D/3D»: режим сейчас и при следующих визитах. */
  function chooseMode(next: Mode) {
    userChoice.value = next
    save(KEY.sceneChoice, next)
    mode.value = next
  }

  /** «Continue without 3D»: 2D сейчас и при следующих визитах. */
  function continueWithout3D() {
    userChoice.value = '2d'
    save(KEY.sceneChoice, '2d')
    mode.value = '2d'
    sceneState.value = 'idle'
  }

  /** Сцена не успела (таймаут) или не загрузилась: 2D с баннером, но это не выбор пользователя. */
  function sceneTimedOut() {
    mode.value = '2d'
    sceneState.value = 'failed'
  }

  function dismissSceneBanner() {
    if (sceneState.value === 'failed') sceneState.value = 'idle'
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
    lang,
    mode,
    motionPaused,
    userChoice,
    sceneState,
    activeStop,
    openWindow,
    visitedStops,
    setLang,
    syncLang,
    toggleLang,
    toggleMotion,
    setMode,
    setSceneState,
    chooseMode,
    continueWithout3D,
    sceneTimedOut,
    dismissSceneBanner,
    openChapter,
    closeWindow,
  }
})
