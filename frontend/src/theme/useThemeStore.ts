import { defineStore } from 'pinia'
import { ref } from 'vue'
import { load, save } from '../shared/lib'
import { palette, type ThemeName } from './palette'

export type Theme = ThemeName

export const THEMES: readonly Theme[] = ['day', 'evening', 'night']

/** Тот же ключ читает boot-скрипт до старта приложения (theme/boot.ts). */
const KEY = 'aboutme.theme'

export function isTheme(value: string | null): value is Theme {
  return THEMES.includes(value as Theme)
}

export const useThemeStore = defineStore('theme', () => {
  const saved = load(KEY)
  const theme = ref<Theme>(isTheme(saved) ? saved : 'day')

  function setTheme(next: Theme) {
    theme.value = next
    save(KEY, next)
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

  return { theme, setTheme, previewTheme, cycleTheme, applyTheme }
})
