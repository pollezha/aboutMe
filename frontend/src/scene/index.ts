// Ленивая загрузка 3D-сцены (design §4 «Загрузка», п. 3): чанк three + TresJS запрашивается сразу после
// монтирования приложения и только если shouldUse3D() — решает модуль mode. На десктопе чанк к этому
// моменту уже качается: его preload ставит inline-скрипт в <head> (scene/preload.ts), ожидание простоя
// откладывало scene_ready за бюджет 4 с (T12b).
// Этот модуль в main-чанке: он не должен статически импортировать ничего из three/TresJS. Кроме загрузчика
// отдаёт лёгкие модули без three: пороги 3D, поворот карты, preload-скрипт. Снаружи доступен только модулю mode.
import type { Component } from 'vue'

export { scenePreloadScript, type PreloadLimits, type PreloadWindow } from './preload'
export { MIN_3D_MEMORY_GB, MIN_3D_WIDTH } from './thresholds'
export { isRotateHotkey, mapRotation, type MapRotation, type Rotation } from './useCamera'

/** Нет `scene_ready` за это время с начала загрузки → 2D и баннер (review-consolidated п. 23, UX9). */
export const SCENE_TIMEOUT_MS = 8000

export type SceneImporter = () => Promise<{ default: Component }>

const importScene: SceneImporter = () => import('./Scene.vue')

export interface SceneLoad {
  promise: Promise<Component>
  cancel: () => void
}

export function loadScene(importer: SceneImporter = importScene): SceneLoad {
  let cancelled = false
  let handle: ReturnType<typeof setTimeout> | undefined

  // Следующая задача, а не сразу: монтирование и первый кадр HTML-слоя не ждут разбора чанка.
  const promise = new Promise<Component>((resolve, reject) => {
    handle = setTimeout(() => {
      if (cancelled) return
      importer().then((module) => resolve(module.default), reject)
    }, 0)
  })

  return {
    promise,
    cancel() {
      cancelled = true
      clearTimeout(handle)
    },
  }
}
