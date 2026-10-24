// Какой режим показать сейчас (design §4 «Загрузка», FR10): ?mode=, сохранённый выбор, ширина и WebGL2.
import { computed, toRef, watch, type Ref } from 'vue'
import { MIN_3D_WIDTH } from '../scene'
import type { Breakpoint } from '../shared/lib'
import { detectWebGL2, shouldUse3D } from './shouldUse3D'
import { useModeStore, type Mode } from './useModeStore'

// Тот же предикат, что у CSS (width < 768px) и useBreakpoint: matchMedia, а не innerWidth
// (innerWidth включает полосу прокрутки и расходится с медиа-запросами на её ширину).
function isWide() {
  if (typeof window.matchMedia !== 'function') return window.innerWidth >= MIN_3D_WIDTH
  return window.matchMedia(`(min-width: ${MIN_3D_WIDTH}px)`).matches
}

function readUrlMode(): Mode | null {
  if (typeof window === 'undefined') return null
  const value = new URLSearchParams(window.location.search).get('mode')
  return value === '2d' || value === '3d' ? value : null
}

/** Выбор режима при монтировании и смене брейкпоинта; кнопка «Switch to 2D/3D». */
export function useViewMode(breakpoint: Readonly<Ref<Breakpoint>>) {
  const store = useModeStore()

  // ?mode=2d|3d переопределяет сохранённый выбор на этот визит (ссылки, скриншоты), но не запоминается;
  // 3D и по ссылке — только там, где оно возможно (ширина, WebGL). Кнопка переключения важнее ссылки.
  let urlMode = readUrlMode()

  // Сцена не загрузилась в этом визите (отмечает useSceneLoader через стор) — до перезагрузки страницы
  // в 3D не возвращаемся, и при смене ширины тоже.
  const sceneFailed = toRef(store, 'sceneFailed')
  // Проба WebGL2 создаёт контекст (дорого на слабом CPU) — только там, где 3D возможно по ширине, и один раз.
  let webgl: boolean | undefined
  const hasWebGL = () => (webgl ??= detectWebGL2())

  function use3D(userChoice: Mode | null) {
    if (typeof window === 'undefined' || sceneFailed.value) return false
    const nav = navigator as Navigator & { deviceMemory?: number }
    const wide = isWide()
    return shouldUse3D({
      width: wide ? MIN_3D_WIDTH : 0,
      webgl: wide && hasWebGL(),
      deviceMemory: nav.deviceMemory,
      userChoice,
    })
  }

  function detectMode() {
    if (typeof window === 'undefined') return
    store.setMode(use3D(urlMode ?? store.userChoice) ? '3d' : '2d')
  }

  detectMode()
  watch(breakpoint, detectMode)

  // Из 3D в 2D — всегда, из 2D в 3D — только если сцена здесь возможна (на ширине < 768, без WebGL2 или
  // после сбоя сцены кнопки нет). Выбор запоминается.
  const canSwitchMode = computed(
    () => breakpoint.value !== 'mobile' && (store.mode === '3d' || use3D(null)),
  )

  function switchMode() {
    urlMode = null
    store.chooseMode(store.mode === '3d' ? '2d' : '3d')
  }

  return { store, sceneFailed, canSwitchMode, switchMode, detectMode }
}
