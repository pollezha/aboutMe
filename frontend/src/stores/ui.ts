import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ChapterId } from '../content/chapters'
import { palette } from '../theme/palette'

export type Lang = 'en' | 'ru'
export type Theme = 'day' | 'evening' | 'night'
export type Mode = '3d' | '2d'
/** idle — сцена не грузится; loading — ждём scene_ready; ready — сцена на экране; failed — таймаут/ошибка, показан баннер. */
export type SceneState = 'idle' | 'loading' | 'ready' | 'failed'

const THEMES: readonly Theme[] = ['day', 'evening', 'night']
const LANGS: readonly Lang[] = ['en', 'ru']
const MODES: readonly Mode[] = ['3d', '2d']

const KEY = {
  theme: 'aboutme.theme',
  lang: 'aboutme.lang',
  motionPaused: 'aboutme.motionPaused',
  sceneChoice: 'aboutme.sceneChoice',
} as const

// localStorage может быть недоступен (приватный режим, квота, SSR) — настройки тогда живут только в памяти.
function load(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function save(key: string, value: string) {
  try {
    globalThis.localStorage?.setItem(key, value)
  } catch {
    /* хранилище недоступно — не критично */
  }
}

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

export function isTheme(value: string | null): value is Theme {
  return THEMES.includes(value as Theme)
}

export const useUiStore = defineStore('ui', () => {
  const theme = ref<Theme>(pick(load(KEY.theme), THEMES, 'day'))
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

  function setTheme(next: Theme) {
    theme.value = next
    save(KEY.theme, next)
  }

  /** Тема из ссылки (?theme=night): показываем, но не запоминаем как выбор пользователя. */
  function previewTheme(next: Theme) {
    theme.value = next
  }

  function cycleTheme() {
    setTheme(THEMES[(THEMES.indexOf(theme.value) + 1) % THEMES.length] ?? 'day')
  }

  /** Тема → <html data-theme>, color-scheme (полосы прокрутки, формы) и <meta name="theme-color">. */
  function applyTheme() {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    root.dataset.theme = theme.value
    root.style.colorScheme = theme.value === 'night' ? 'dark' : 'light'
    document
      .querySelector<HTMLMetaElement>('meta#theme-color')
      ?.setAttribute('content', palette[theme.value]['bg/canvas'])
  }

  function setLang(next: Lang) {
    lang.value = next
    save(KEY.lang, next)
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

  /** Клик по остановке/хотспоту/кнопке: окно открывается сразу (D5), остановка становится активной. */
  function openChapter(id: ChapterId) {
    activeStop.value = id
    openWindow.value = id
  }

  function closeWindow() {
    openWindow.value = null
  }

  return {
    theme,
    lang,
    mode,
    motionPaused,
    userChoice,
    sceneState,
    activeStop,
    openWindow,
    setTheme,
    previewTheme,
    cycleTheme,
    applyTheme,
    setLang,
    toggleLang,
    toggleMotion,
    setMode,
    setSceneState,
    continueWithout3D,
    sceneTimedOut,
    dismissSceneBanner,
    openChapter,
    closeWindow,
  }
})
