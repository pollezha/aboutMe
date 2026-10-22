// Ленивая загрузка 3D-сцены (design §4 «Загрузка», п. 3): чанк three + TresJS запрашивается только
// после того, как браузер освободился, и только если shouldUse3D() — решает вызывающий код (App.vue).
// Этот модуль в main-чанке: он не должен статически импортировать ничего из three/TresJS.
import type { Component } from 'vue'

/** Сколько ждать без requestIdleCallback (Safari): первый кадр HTML-слоя успевает отрисоваться. */
export const IDLE_FALLBACK_MS = 200
/** Верхняя граница ожидания простоя: на постоянно занятом потоке сцена всё равно начнёт грузиться. */
export const IDLE_MAX_WAIT_MS = 2000
/** Нет `scene_ready` за это время с начала загрузки → 2D и баннер (review-consolidated п. 23, UX9). */
export const SCENE_TIMEOUT_MS = 8000

export type SceneImporter = () => Promise<{ default: Component }>

const importScene: SceneImporter = () => import('./Scene.vue')

export interface SceneLoad {
  promise: Promise<Component>
  cancel: () => void
}

export function loadSceneWhenIdle(importer: SceneImporter = importScene): SceneLoad {
  let cancelled = false
  let cancelIdle = () => {}

  const promise = new Promise<Component>((resolve, reject) => {
    const start = () => {
      if (cancelled) return
      importer().then((module) => resolve(module.default), reject)
    }
    if (typeof globalThis.requestIdleCallback === 'function') {
      const handle = globalThis.requestIdleCallback(start, { timeout: IDLE_MAX_WAIT_MS })
      cancelIdle = () => globalThis.cancelIdleCallback?.(handle)
    } else {
      const handle = setTimeout(start, IDLE_FALLBACK_MS)
      cancelIdle = () => clearTimeout(handle)
    }
  })

  return {
    promise,
    cancel() {
      cancelled = true
      cancelIdle()
    },
  }
}
