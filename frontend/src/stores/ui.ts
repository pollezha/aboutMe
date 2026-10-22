import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ChapterId } from '../content/chapters'

export type Lang = 'en' | 'ru'
export type Theme = 'day' | 'evening' | 'night'
export type Mode = '3d' | '2d'

const THEMES: readonly Theme[] = ['day', 'evening', 'night']
const LANGS: readonly Lang[] = ['en', 'ru']

const KEY = {
  theme: 'aboutme.theme',
  lang: 'aboutme.lang',
  motionPaused: 'aboutme.motionPaused',
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
  const activeStop = ref<ChapterId | null>(null)
  const openWindow = ref<ChapterId | null>(null)

  function setTheme(next: Theme) {
    theme.value = next
    save(KEY.theme, next)
  }

  function cycleTheme() {
    setTheme(THEMES[(THEMES.indexOf(theme.value) + 1) % THEMES.length] ?? 'day')
  }

  function applyTheme() {
    if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme.value
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
    activeStop,
    openWindow,
    setTheme,
    cycleTheme,
    applyTheme,
    setLang,
    toggleLang,
    toggleMotion,
    setMode,
    openChapter,
    closeWindow,
  }
})
