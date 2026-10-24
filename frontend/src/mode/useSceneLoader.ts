// Загрузка 3D-сцены (design §4 «Загрузка», UX9): ленивый чанк сразу после монтирования в 3D, нет первого
// кадра за SCENE_TIMEOUT_MS → 2D с баннером. Состояние — в сторе режима, компонент сцены — здесь.
import { onScopeDispose, shallowRef, watch, type Component } from 'vue'
import { SCENE_TIMEOUT_MS, loadScene, type SceneImporter, type SceneLoad } from '../scene'
import { useModeStore } from './useModeStore'

export interface SceneLoaderOptions {
  /** Подмена импорта чанка (тесты); по умолчанию — ленивый `scene/Scene.vue` из `loadScene`. */
  importer?: SceneImporter
}

export function useSceneLoader(options: SceneLoaderOptions = {}) {
  const store = useModeStore()
  const component = shallowRef<Component>()
  let sceneLoad: SceneLoad | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  function stop() {
    sceneLoad?.cancel()
    sceneLoad = null
    clearTimeout(timer)
  }

  /** Только в 3D и только один раз за попытку: повторный вызов во время загрузки ничего не делает. */
  function start() {
    const busy = store.sceneState === 'loading' || store.sceneState === 'ready'
    if (store.mode !== '3d' || busy) return
    store.setSceneState('loading')
    timer = setTimeout(fail, SCENE_TIMEOUT_MS)
    // Чанк уже загружен (вернулись в 3D) — ждём только первый кадр.
    if (component.value) return
    const load = options.importer ? loadScene(options.importer) : loadScene()
    sceneLoad = load
    load.promise.then(
      (loaded) => {
        if (sceneLoad === load) component.value = loaded
      },
      () => {
        if (sceneLoad === load) fail()
      },
    )
  }

  /** Таймаут или ошибка чанка: 2D с баннером, в этом визите 3D больше не предлагаем. */
  function fail() {
    if (store.sceneState !== 'loading') return
    stop()
    store.sceneTimedOut()
  }

  /** Сцена нарисовала первый кадр. */
  function ready() {
    if (store.sceneState !== 'loading') return
    clearTimeout(timer)
    sceneLoad = null
    performance.mark?.('scene_ready')
    store.setSceneState('ready')
  }

  /** «Continue without 3D»: загрузку бросаем, 2D запоминается. */
  function continueWithout3D() {
    stop()
    store.continueWithout3D()
  }

  watch(
    () => store.mode,
    (mode) => {
      if (mode === '3d') return start()
      stop()
      if (store.sceneState !== 'failed') store.setSceneState('idle')
    },
  )

  onScopeDispose(stop)

  return { component, start, fail, ready, continueWithout3D, stop }
}
