/**
 * Inline-скрипт в <head> (vite.config → transformIndexHtml): ещё до main-чанка ставит
 * `<link rel="modulepreload">` на чанк 3D-сцены — он качается параллельно с приложением, а не после монтирования.
 * Только там, где App выберет 3D (shouldUse3D): ширина ≥ 768, есть WebGL2, памяти не меньше порога, нет выбора 2D.
 * WebGL2 — по наличию API, без создания контекста: скрипт блокирует разбор <head>. Функция сериализуется через
 * toString(), поэтому самодостаточна, а модуль — без импортов (его читает vite.config); ключ
 * `aboutme.sceneChoice` и `?mode=` — те же, что в stores/ui.ts и App.vue.
 */
interface PreloadLink {
  rel: string
  href: string
  as?: string
  crossOrigin?: string | null
}

/** То, что скрипт трогает в window (структурно — чтобы проверять без браузера). */
export interface PreloadWindow {
  location: { search: string }
  localStorage: { getItem(key: string): string | null }
  matchMedia?: (query: string) => { matches: boolean }
  navigator: { deviceMemory?: number }
  WebGL2RenderingContext?: unknown
  document: {
    createElement(tag: 'link'): PreloadLink
    head: { appendChild(node: PreloadLink): unknown }
  }
}

/** Пороги shouldUse3D (scene/thresholds.ts); передаются из vite.config — модуль без импортов. */
export interface PreloadLimits {
  minWidth: number
  minMemory: number
}

function preloadScene(win: PreloadWindow, urls: string[], limits: PreloadLimits) {
  const query = /[?&]mode=(2d|3d)(&|$)/.exec(win.location.search)
  if (query && query[1] === '2d') return
  if (!query) {
    try {
      if (win.localStorage.getItem('aboutme.sceneChoice') === '2d') return
    } catch {
      // Хранилище недоступно — выбор не сохранён.
    }
  }
  if (typeof win.matchMedia !== 'function') return
  if (!win.matchMedia('(min-width: ' + limits.minWidth + 'px)').matches) return
  if (!win.WebGL2RenderingContext) return
  const memory = win.navigator.deviceMemory
  if (memory !== undefined && memory < limits.minMemory) return
  for (const url of urls) {
    const link = win.document.createElement('link')
    if (/\.css$/.test(url)) {
      link.rel = 'preload'
      link.as = 'style'
    } else {
      link.rel = 'modulepreload'
    }
    link.href = url
    link.crossOrigin = ''
    win.document.head.appendChild(link)
  }
}

/** Текст inline-скрипта: вызов preloadScene(window, адреса чанка сцены и его CSS, пороги shouldUse3D). */
export function scenePreloadScript(urls: readonly string[], limits: PreloadLimits): string {
  return `(${preloadScene.toString()})(window,${JSON.stringify(urls)},${JSON.stringify(limits)})`
}
