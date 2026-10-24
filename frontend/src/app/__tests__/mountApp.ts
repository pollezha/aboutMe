import { afterEach, beforeEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import App from '../../App.vue'
import { loadScene } from '../../scene'
import { useLangStore } from '../../locale'
import { useRouteStore } from '../../route'
import { useUiStore } from '../../stores/ui'
import { appPlugins } from './appPlugins'
import { sceneStub } from './sceneStub'

/*
 * Общая обвязка App-спеков. Модули подменяет сам спек (vi.mock поднимается только в своём файле):
 *
 *   vi.mock('../scene/Scene.vue', () => import('../app/__tests__/sceneStub'))
 *   vi.mock('../content/buildTime', () => ({ BUILD_TIME: new Date(2026, 9, 23) }))
 *   vi.mock('../scene', ...)  // loadScene: vi.fn(original.loadScene)
 *
 * и вызывает useAppTestEnv() на верхнем уровне файла.
 */

// jsdom: нет matchMedia, WebGL и showModal() — минимальные подмены.
export function setViewport(width: number) {
  window.innerWidth = width
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query)
    const max = /max-width:\s*(\d+)px/.exec(query)
    const matches =
      (!min || width >= Number(min[1])) && (!max || width <= Number(max[1])) && (!!min || !!max)
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    } as MediaQueryList
  }) as typeof window.matchMedia
}

const dialogProto = HTMLDialogElement.prototype
const originalDialog = { showModal: dialogProto.showModal, close: dialogProto.close }

let wrapper: VueWrapper | undefined

/** beforeEach/afterEach: чистые storage и URL, десктоп 1440 px с WebGL, showModal(); после — размонтировать. */
export function useAppTestEnv() {
  beforeEach(() => {
    localStorage.clear()
    history.replaceState(null, '', '/')
    setViewport(1440)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as RenderingContext)
    dialogProto.showModal = function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }
    dialogProto.close = function (this: HTMLDialogElement) {
      this.removeAttribute('open')
    }
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.restoreAllMocks()
    vi.mocked(loadScene).mockClear()
    vi.useRealTimers()
    sceneStub.drawsFirstFrame = false
    dialogProto.showModal = originalDialog.showModal
    dialogProto.close = originalDialog.close
  })
}

export function mountApp() {
  const pinia = createPinia()
  setActivePinia(pinia)
  wrapper = mount(App, { global: { plugins: appPlugins(pinia) }, attachTo: document.body })
  return { wrapper, ui: useUiStore(), route: useRouteStore(), lang: useLangStore() }
}

/** unhead пишет `<html lang>` в DOM не синхронно — ждём условие. */
export async function waitFor(condition: () => boolean) {
  for (let i = 0; i < 50 && !condition(); i++) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

/** jsdom выполняет history.back() асинхронно. */
export async function waitForHash(hash: string) {
  for (let i = 0; i < 50 && location.hash !== hash; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

export function openDialog(w: VueWrapper) {
  return w.find('dialog[open]')
}
