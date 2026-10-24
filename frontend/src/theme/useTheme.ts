import { computed, watch } from 'vue'
import { isTheme, useThemeStore, type Theme } from './useThemeStore'

/** Перевод передаёт вызывающий (App — t из vue-i18n): модуль темы не зависит от locale. */
export type ThemeTranslate = (key: string, named?: Record<string, unknown>) => string

// Три темы по кругу — не toggle, поэтому без aria-pressed: в имени текущая и следующая тема.
const NEXT_THEME: Record<Theme, Theme> = { day: 'evening', evening: 'night', night: 'day' }

/**
 * Тема страницы: ?theme=night переопределяет сохранённую (ссылки на конкретную тему, скриншоты), но не
 * запоминается; каждое изменение темы уходит в <html> (applyTheme); label — имя кнопки переключения.
 */
export function useTheme(t: ThemeTranslate) {
  const store = useThemeStore()

  if (typeof window !== 'undefined') {
    const queryTheme = new URLSearchParams(window.location.search).get('theme')
    if (isTheme(queryTheme)) store.previewTheme(queryTheme)
  }

  watch(() => store.theme, store.applyTheme, { immediate: true })

  const label = computed(() =>
    t('theme.label', {
      current: t(`theme.${store.theme}`),
      next: t(`theme.${NEXT_THEME[store.theme]}`),
    }),
  )

  return { store, label }
}
