import { defineStore } from 'pinia'
import { ref } from 'vue'
import { load, save } from '../shared/lib'

export type Mode = '3d' | '2d'
/** idle — сцена не грузится; loading — ждём scene_ready; ready — сцена на экране; failed — таймаут/ошибка, показан баннер. */
export type SceneState = 'idle' | 'loading' | 'ready' | 'failed'

const MODES: readonly Mode[] = ['3d', '2d']

const KEY = { sceneChoice: 'aboutme.sceneChoice' } as const

export const useModeStore = defineStore('mode', () => {
  const mode = ref<Mode>('3d')
  /** Явный выбор пользователя (FR10); null — не выбирал, режим решает shouldUse3D(). */
  const savedChoice = load(KEY.sceneChoice)
  const userChoice = ref<Mode | null>(
    MODES.includes(savedChoice as Mode) ? (savedChoice as Mode) : null,
  )
  const sceneState = ref<SceneState>('idle')

  function setMode(next: Mode) {
    mode.value = next
  }

  function setSceneState(next: SceneState) {
    sceneState.value = next
  }

  /** Кнопка «Switch to 2D/3D»: режим сейчас и при следующих визитах. */
  function chooseMode(next: Mode) {
    userChoice.value = next
    save(KEY.sceneChoice, next)
    mode.value = next
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

  return {
    mode,
    userChoice,
    sceneState,
    setMode,
    setSceneState,
    chooseMode,
    continueWithout3D,
    sceneTimedOut,
    dismissSceneBanner,
  }
})
