/**
 * Inline-скрипт в начале <head> (vite.config → transformIndexHtml): до CSS и до приложения ставит тему
 * (`data-theme`, `color-scheme`, `meta#theme-color`) и один раз уводит на /ru/ (design §4 «Загрузка», FR8).
 * Функция сериализуется через toString(), поэтому самодостаточна: ни импортов, ни внешних констант.
 * Ключи и значения — те же, что в stores/ui.ts (`aboutme.theme`, `aboutme.lang`, `?theme=`).
 */

/** Цвет `bg/canvas` каждой темы — из palette.ts при сборке. */
export type ThemeColors = Record<'day' | 'evening' | 'night', string>

/** То, что скрипт трогает в window (структурно — чтобы проверять без браузера). */
export interface BootWindow {
  document: {
    documentElement: { dataset: Record<string, string | undefined>; style: { colorScheme: string } }
    getElementById(id: string): { setAttribute(name: string, value: string): void } | null
  }
  localStorage: { getItem(key: string): string | null }
  location: { pathname: string; search: string; hash: string; replace(url: string): void }
  navigator: { language?: string }
}

// Хранилище недоступно (saved = null): тема по умолчанию, язык не угадываем — выбор всё равно не запомнится.
function boot(win: BootWindow, colors: Record<string, string>) {
  let saved: { theme: string | null; lang: string | null } | null = null
  try {
    saved = {
      theme: win.localStorage.getItem('aboutme.theme'),
      lang: win.localStorage.getItem('aboutme.lang'),
    }
  } catch {
    saved = null
  }
  const preview = /[?&]theme=(day|evening|night)(&|$)/.exec(win.location.search)
  let theme = preview ? preview[1]! : (saved && saved.theme) || 'day'
  if (!Object.prototype.hasOwnProperty.call(colors, theme)) theme = 'day'
  const root = win.document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme === 'night' ? 'dark' : 'light'
  const meta = win.document.getElementById('theme-color')
  if (meta) meta.setAttribute('content', colors[theme]!)

  if (!saved || /^\/ru(\/|$)/.test(win.location.pathname)) return
  const wantsRu = saved.lang ? saved.lang === 'ru' : /^ru\b/i.test(win.navigator.language || '')
  if (wantsRu) win.location.replace('/ru/' + win.location.search + win.location.hash)
}

/** Текст inline-скрипта: вызов boot(window, цвета тем). */
export function bootScript(colors: ThemeColors): string {
  return `(${boot.toString()})(window,${JSON.stringify(colors)})`
}
